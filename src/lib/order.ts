/** Moves `id` to the index currently held by `targetId`; returns the same array when nothing moves. */
export function moveId(ids: string[], id: string, targetId: string): string[] {
  const from = ids.indexOf(id)
  const to = ids.indexOf(targetId)
  if (from < 0 || to < 0 || from === to) return ids
  const next = ids.slice()
  next.splice(from, 1)
  next.splice(to, 0, id)
  return next
}
