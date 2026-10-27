export function civilDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const instant = new Date(value + 'T12:00:00Z')
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value
}
export function monthDate(value: unknown): value is string { return civilDate(value) && value.endsWith('-01') }
export function shiftMonth(month: string, offset: -1 | 1) {
  if (!monthDate(month)) throw new Error('Invalid calendar month')
  const absolute = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + offset
  const year = Math.floor(absolute / 12), number = absolute % 12 + 1
  return year < 1 || year > 9999 ? null : `${String(year).padStart(4, '0')}-${String(number).padStart(2, '0')}-01`
}
export function monthDays(month: string) {
  if (!monthDate(month)) throw new Error('Invalid calendar month')
  const start = new Date(month + 'T12:00:00Z')
  const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0)
  return Array.from({ length: end.getUTCDate() }, (_, day) => month.slice(0, 8) + String(day + 1).padStart(2, '0'))
}
export function calendarWeeks<T extends { date: string }>(days: T[]) {
  const offset = new Date(days[0].date + 'T12:00:00Z').getUTCDay()
  const cells: (T | null)[] = [...Array.from({ length: offset }, () => null), ...days]
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7))
}
// These are civil labels, not instants to reinterpret in the device's time zone.
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(month + 'T12:00:00Z'))
}
export function dayLabel(day: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(day + 'T12:00:00Z'))
}
