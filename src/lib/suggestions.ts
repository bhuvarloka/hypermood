import { createAdminClient } from '@/lib/supabase/admin'
import type { BaseLayerMetadata } from '@/types/domain'

const MAX_SUGGESTIONS = 4
const MIN_IMAGES_FOR_SUGGESTIONS = 3

type RollStats = {
  total: number
  settingCounts: Record<string, number>
  timeOfDayCounts: Record<string, number>
  topTags: string[]
  qualityHigh: number
  // people count buckets: none, solo (1), small group (2-4), large group (5+)
  peopleNone: number
  peopleSolo: number
  peopleSmallGroup: number
  peopleLargeGroup: number
}

export async function generateRollSuggestions(rollId: string): Promise<string[]> {
  const stats = await aggregateRollStats(rollId)
  if (stats.total < MIN_IMAGES_FOR_SUGGESTIONS) return []
  return buildSuggestions(stats)
}

async function aggregateRollStats(rollId: string): Promise<RollStats> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('image_metadata')
    .select('metadata, images!inner(roll_id, status)')
    .eq('images.roll_id', rollId)
    .eq('images.status', 'indexed')

  if (error) throw new Error(`Failed to fetch metadata for roll ${rollId}: ${error.message}`)

  const rows = (data ?? []) as unknown as { metadata: BaseLayerMetadata }[]

  const settingCounts: Record<string, number> = {}
  const timeOfDayCounts: Record<string, number> = {}
  const tagFrequency: Record<string, number> = {}
  let qualityHigh = 0
  let peopleNone = 0
  let peopleSolo = 0
  let peopleSmallGroup = 0
  let peopleLargeGroup = 0

  for (const { metadata } of rows) {
    const setting = metadata.scene?.setting
    if (setting && setting !== 'not applicable') {
      settingCounts[setting] = (settingCounts[setting] ?? 0) + 1
    }

    const tod = metadata.scene?.time_of_day
    if (tod && tod !== 'unknown') {
      timeOfDayCounts[tod] = (timeOfDayCounts[tod] ?? 0) + 1
    }

    for (const tag of metadata.tags ?? []) {
      tagFrequency[tag] = (tagFrequency[tag] ?? 0) + 1
    }

    if ((metadata.quality_score ?? 0) >= 0.7) qualityHigh++

    const count = metadata.people?.count ?? 0
    if (count === 0) peopleNone++
    else if (count === 1) peopleSolo++
    else if (count <= 4) peopleSmallGroup++
    else peopleLargeGroup++
  }

  const topTags = Object.entries(tagFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag)

  return {
    total: rows.length,
    settingCounts,
    timeOfDayCounts,
    topTags,
    qualityHigh,
    peopleNone,
    peopleSolo,
    peopleSmallGroup,
    peopleLargeGroup,
  }
}

function buildSuggestions(stats: RollStats): string[] {
  const suggestions: string[] = []
  const { total } = stats

  const topSetting = topEntry(stats.settingCounts)
  if (topSetting && stats.settingCounts[topSetting] >= total * 0.3) {
    suggestions.push(
      topSetting === 'outdoor'
        ? 'Show me all the outdoor shots'
        : topSetting === 'indoor'
          ? 'Show me the indoor shots'
          : `Show me the ${topSetting} shots`,
    )
  }

  const topTime = topEntry(stats.timeOfDayCounts)
  if (topTime && stats.timeOfDayCounts[topTime] >= total * 0.2) {
    suggestions.push(`Find the ${topTime} photos`)
  }

  // Pick the most characterising people-range suggestion based on which bucket dominates.
  const dominantPeople = topEntry({
    none: stats.peopleNone,
    solo: stats.peopleSolo,
    small_group: stats.peopleSmallGroup,
    large_group: stats.peopleLargeGroup,
  })
  if (dominantPeople && suggestions.length < MAX_SUGGESTIONS) {
    if (dominantPeople === 'none' && stats.peopleNone >= total * 0.5) {
      suggestions.push('Find images without people')
    } else if (dominantPeople === 'solo' && stats.peopleSolo >= total * 0.25) {
      suggestions.push('Show me the portraits')
    } else if (dominantPeople === 'small_group' && stats.peopleSmallGroup >= total * 0.25) {
      suggestions.push('Show me the small group shots')
    } else if (dominantPeople === 'large_group' && stats.peopleLargeGroup >= total * 0.2) {
      suggestions.push('Find the group shots')
    }
  }

  if (suggestions.length < MAX_SUGGESTIONS && stats.qualityHigh >= 3) {
    suggestions.push('Show me the best quality shots')
  }

  if (suggestions.length < MAX_SUGGESTIONS && stats.topTags.length > 0) {
    suggestions.push(`Find all ${stats.topTags[0]} images`)
  }

  return suggestions.slice(0, MAX_SUGGESTIONS)
}

function topEntry(counts: Record<string, number>): string | null {
  const entries = Object.entries(counts)
  if (entries.length === 0) return null
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0]
}
