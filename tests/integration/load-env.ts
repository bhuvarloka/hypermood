import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

for (const file of ['.env.local', '.env.test.local']) {
  const path = resolve(process.cwd(), file)
  if (!existsSync(path)) continue
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const k = trimmed.slice(0, eq).trim()
    const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (process.env[k] == null) process.env[k] = v
  }
}
