/**
 * Reorders an array by moving the item at dragIndex to dropIndex.
 * Returns a new array; does not mutate the input.
 * Returns the original array reference if dragIndex === dropIndex.
 */
export function reorderItems<T>(items: T[], dragIndex: number, dropIndex: number): T[] {
  if (dragIndex === dropIndex) return items
  const next = [...items]
  const [moved] = next.splice(dragIndex, 1)
  next.splice(dropIndex, 0, moved)
  return next
}
