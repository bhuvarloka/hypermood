import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { executeQuery } from '@/lib/gemini/query-executor'

const ROLL_ID = process.env.TEST_ROLL_ID ?? '7db5f829-fd82-44c5-bd1a-18b8a1b5d2b2'

const IMG = {
  wrestling: 'fc16cef3',
  staircase: '1b89d588',
  photographers: '26484fe7',
  flies: '2c19c556',
  coleus: '22491b96',
  leafCloseup: 'df44379c',
  moth: 'bf86f90b',
  portrait: 'c6c01ed5',
} as const

type Filter = { field: string; operator: string; value: unknown }

type Case = {
  label: string
  filters: Filter[]
  semantic: string | null
  mustInclude?: string[]
  mustExclude?: string[]
  minTopN?: { n: number; ids: string[]; atLeast: number }
}

const CASES: Case[] = [
  {
    label: 'people ≥ 1 returns exactly the three with people',
    filters: [{ field: 'people.count', operator: 'gte', value: 1 }],
    semantic: null,
    mustInclude: [IMG.wrestling, IMG.photographers, IMG.portrait],
    mustExclude: [IMG.staircase, IMG.flies, IMG.coleus, IMG.leafCloseup, IMG.moth],
  },
  {
    label: 'outdoor returns the two outdoor scenes',
    filters: [{ field: 'scene.setting', operator: 'eq', value: 'outdoor' }],
    semantic: null,
    mustInclude: [IMG.staircase, IMG.photographers],
    mustExclude: [IMG.wrestling, IMG.flies, IMG.coleus, IMG.portrait],
  },
  {
    label: 'has_text returns only the photographers shot',
    filters: [{ field: 'text_content.has_text', operator: 'eq', value: true }],
    semantic: null,
    mustInclude: [IMG.photographers],
    mustExclude: [IMG.wrestling, IMG.staircase, IMG.flies, IMG.coleus, IMG.leafCloseup, IMG.moth, IMG.portrait],
  },
  {
    label: 'no screenshots in the roll',
    filters: [{ field: 'technical.is_screenshot', operator: 'eq', value: true }],
    semantic: null,
    mustExclude: Object.values(IMG),
  },
  {
    label: 'high quality ≥ 0.9 includes the four sharp shots',
    filters: [{ field: 'quality_score', operator: 'gte', value: 0.9 }],
    semantic: null,
    mustInclude: [IMG.flies, IMG.coleus, IMG.leafCloseup, IMG.portrait],
    mustExclude: [IMG.wrestling],
  },
  {
    label: 'vibrant mood excludes the high-contrast portrait and mixed shots',
    filters: [{ field: 'colors.palette_mood', operator: 'eq', value: 'vibrant' }],
    semantic: null,
    mustInclude: [IMG.wrestling, IMG.coleus, IMG.leafCloseup, IMG.moth],
    mustExclude: [IMG.staircase, IMG.photographers, IMG.flies, IMG.portrait],
  },
  {
    label: 'semantic: portrait of a person ranks the portrait first',
    filters: [],
    semantic: 'studio portrait of a person face lighting',
    minTopN: { n: 1, ids: [IMG.portrait], atLeast: 1 },
  },
  {
    label: 'semantic: insects ranks flies + moth in top 3',
    filters: [],
    semantic: 'insect bug close-up macro',
    minTopN: { n: 3, ids: [IMG.flies, IMG.moth], atLeast: 2 },
  },
  {
    label: 'semantic: leaves and plants ranks botanical shots in top 4',
    filters: [],
    semantic: 'green leaves plant botanical foliage',
    minTopN: { n: 4, ids: [IMG.coleus, IMG.leafCloseup, IMG.staircase], atLeast: 2 },
  },
]

let userClient: SupabaseClient
const shortIdMap = new Map<string, string>()

beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = process.env.TEST_USER_EMAIL
  if (!url || !serviceKey || !anonKey || !email) {
    throw new Error('Missing one of NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY / TEST_USER_EMAIL')
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkErr || !link?.properties?.email_otp) throw new Error(`generateLink failed: ${linkErr?.message ?? 'no email_otp'}`)

  userClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: verifyErr } = await userClient.auth.verifyOtp({ type: 'email', email, token: link.properties.email_otp })
  if (verifyErr) throw new Error(`verifyOtp failed: ${verifyErr.message}`)

  const { data } = await userClient.from('images').select('id').eq('roll_id', ROLL_ID)
  for (const row of data ?? []) shortIdMap.set((row.id as string).slice(0, 8), row.id as string)
  if (shortIdMap.size === 0) throw new Error('test user sees no images in the roll — auth or RLS misconfigured')
})

function full(shortId: string): string {
  const id = shortIdMap.get(shortId)
  if (!id) throw new Error(`seed image ${shortId} not found — roll contents drifted from the test fixture`)
  return id
}

async function run(c: Case): Promise<string[]> {
  const result = await executeQuery(
    {
      filters: c.filters as never,
      semantic_search: c.semantic,
      sort: null,
      limit: 10,
      clarification_note: null,
      followups: [],
    },
    ROLL_ID,
    null,
    userClient,
  )
  return result.images.map((img) => img.id)
}

describe('T-09 vision metadata correctness on the 8-image seed roll', () => {
  for (const c of CASES) {
    it(c.label, async () => {
      const ids = await run(c)
      const idSet = new Set(ids)

      for (const shortId of c.mustInclude ?? []) {
        const id = full(shortId)
        expect(idSet, `expected ${shortId} in results for "${c.label}"`).toContain(id)
      }
      for (const shortId of c.mustExclude ?? []) {
        const id = full(shortId)
        expect(idSet, `expected ${shortId} absent for "${c.label}"`).not.toContain(id)
      }
      if (c.minTopN) {
        const topN = new Set(ids.slice(0, c.minTopN.n))
        const hits = c.minTopN.ids.filter((s) => topN.has(full(s))).length
        expect(hits, `expected ≥${c.minTopN.atLeast} of [${c.minTopN.ids.join(', ')}] in top ${c.minTopN.n}`).toBeGreaterThanOrEqual(c.minTopN.atLeast)
      }
    }, 60_000)
  }
})
