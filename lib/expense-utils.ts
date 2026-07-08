export type GroupTotalable = {
  amount: number
  is_per_pax?: boolean | null
  pax_count?: number | null
}

/**
 * Single source of truth for an expense's group total.
 * If is_per_pax is true, multiplies amount × pax count.
 * pax_count is locked at save time; falls back to tripPartySize at read time.
 */
export function groupTotal(expense: GroupTotalable, tripPartySize: number): number {
  if (!expense.is_per_pax) return expense.amount
  const pax = expense.pax_count ?? tripPartySize ?? 1
  return expense.amount * pax
}
