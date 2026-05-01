export const DAY_COLORS = [
  '#FF9999','#FFB366','#FFEB99','#99FF99','#99D9FF',
  '#CC99FF','#FF99CC','#99FFCC','#FFD699',
] as const;
export function getDayColor(dayNumber: number): string {
  return DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length] || DAY_COLORS[0];
}
export function calculateDayNumber(activityDate: string | Date, tripStartDate: string | Date): number {
  const activity = new Date(activityDate); const tripStart = new Date(tripStartDate);
  activity.setHours(0,0,0,0); tripStart.setHours(0,0,0,0);
  return Math.floor((activity.getTime() - tripStart.getTime()) / 86400000) + 1;
}
