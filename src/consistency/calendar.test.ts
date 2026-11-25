import { describe, expect, it } from 'vitest'
import { calendarWeeks, civilDate, dayLabel, monthDays, monthLabel, presenceWeek, shiftMonth } from './calendar'
describe('calendário civil sem relógio do dispositivo', () => {
  it('respeita fevereiro e séculos bissextos', () => {
    expect(monthDays('2024-02-01')).toHaveLength(29)
    expect(monthDays('1900-02-01')).toHaveLength(28)
    expect(monthDays('2000-02-01').at(-1)).toBe('2000-02-29')
  })
  it('navega dezembro e janeiro nos dois sentidos', () => {
    expect(shiftMonth('2026-12-01', 1)).toBe('2027-01-01')
    expect(shiftMonth('2027-01-01', -1)).toBe('2026-12-01')
  })
  it('trata o ano 1 sem conversão para 1901 e limita ano 9999', () => {
    expect(monthDays('0001-01-01')[0]).toBe('0001-01-01')
    expect(shiftMonth('0001-01-01', -1)).toBeNull()
    expect(shiftMonth('9999-12-01', 1)).toBeNull()
    expect(monthDays('9999-12-01').at(-1)).toBe('9999-12-31')
  })
  it('alinha semanas de domingo a sábado sem fabricar dias nos espaços', () => {
    const weeks = calendarWeeks(monthDays('2024-02-01').map(date => ({ date })))
    expect(weeks).toHaveLength(5)
    expect(weeks[0].slice(0, 4)).toEqual([null, null, null, null])
    expect(weeks[0][4]?.date).toBe('2024-02-01')
    expect(weeks[4][4]?.date).toBe('2024-02-29')
    expect(weeks[4][5]).toBeNull()
  })
  it('inicia domingo na primeira coluna', () => {
    expect(calendarWeeks(monthDays('2026-02-01').map(date => ({ date })))[0][0]?.date).toBe('2026-02-01')
  })
  it('rótulos civis preservam primeiro dia e mês em português', () => {
    expect(dayLabel('2019-01-01')).toBe('1 de janeiro de 2019')
    expect(monthLabel('2018-11-01')).toBe('novembro de 2018')
  })
  it('monta a semana do servidor, incluindo mês anterior, sem inferir conclusão desconhecida', () => {
    const current = monthDays('2026-11-01').map(date => ({ date, completions: date === '2026-11-01' ? 1 : 0 }))
    const week = presenceWeek('2026-11-01', current)
    expect(week.map(day => day.date)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    expect(week[0].completed).toBeNull()
    expect(presenceWeek('2026-11-01', current, [{ date: '2026-10-26', completions: 2 }])[0].completed).toBe(true)
    expect(week[6]).toMatchObject({ today: true, completed: true })
  })
  it('marca futuros sem depender do relógio do dispositivo', () => {
    const week = presenceWeek('2026-10-28', monthDays('2026-10-01').map(date => ({ date, completions: 0 })))
    expect(week[2]).toMatchObject({ date: '2026-10-28', today: true, future: false })
    expect(week[3]).toMatchObject({ date: '2026-10-29', future: true, completed: false })
  })
  it.each(['2026-02-30', '2026-13-01', '0000-01-01', 'bad'])('recusa data inválida %s', value => {
    expect(civilDate(value)).toBe(false)
    expect(() => monthDays(value)).toThrow()
  })
})
