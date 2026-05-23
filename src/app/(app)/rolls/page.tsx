import { listRollsCached } from '@/lib/rolls/list'
import { getRollThumbnails } from '@/lib/rolls/thumbnails'
import { RollCard } from '@/components/roll/roll-card'
import { NewRollButton } from '@/components/roll/new-roll-button'

export default async function RollsPage() {
  const rolls = await listRollsCached()
  const rollIds = rolls.map((r) => r.id)
  const thumbnails = await getRollThumbnails(rollIds)

  const totalImages = rolls.reduce((sum, r) => sum + r.image_count, 0)
  const totalIndexed = rolls.reduce((sum, r) => sum + r.indexed_count, 0)

  return (
    <div className="min-h-full px-10 py-10">
      <div className="flex items-baseline justify-between mb-10">
        <h1 className="text-3xl font-medium">Rolls</h1>
        <NewRollButton />
      </div>

      <div className="flex gap-8 mb-10">
        <Stat singular="roll" plural="rolls" value={rolls.length} />
        <Stat singular="image" plural="images" value={totalImages} />
        <Stat singular="indexed" plural="indexed" value={totalIndexed} />
      </div>

      {rolls.length === 0 ? (
        <p className="text-lg text-primary-400">No rolls yet. Create your first roll to begin.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-primary-100">
          {rolls.map((roll) => (
            <RollCard
              key={roll.id}
              roll={roll}
              storageKeys={thumbnails[roll.id] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ singular, plural, value }: { singular: string; plural: string; value: number }) {
  return (
    <span className="text-sm tracking-tight tabular-nums text-primary-400">
      {value.toLocaleString()} {value === 1 ? singular : plural}
    </span>
  )
}
