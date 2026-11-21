export const palette = ['#ff5500', '#7c4dff', '#14b8a6', '#f43f5e', '#f59e0b', '#38bdf8']
export const percent = (part: number, total: number) => total > 0 ? Math.round((100 * part) / total) : 0
export const number = (value: number) => value.toLocaleString('pt-BR')
export const shortDay = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`
