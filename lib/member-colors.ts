export const MEMBER_COLORS = ["#6D8F87", "#A9D6C5", "#E8DDD0"] as const

export function getMemberColor(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length]!
}
