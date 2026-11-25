import { beforeEach, describe, expect, it } from 'vitest'
import { deviceKey, forgetDeviceKey } from './device'

describe('chave local do aparelho de lembretes', () => {
  beforeEach(() => localStorage.clear())
  it('cria a chave sob demanda e a mantém entre leituras', () => {
    expect(deviceKey('pessoa')).toBeNull()
    const key = deviceKey('pessoa', true)
    expect(key).toMatchObject({ id: expect.stringMatching(/^[0-9a-f-]{36}$/i), secret: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) })
    expect(deviceKey('pessoa')).toEqual(key)
  })
  it('cancelar de propósito esquece só a chave desta pessoa, e a reativação automática deixa de valer', () => {
    deviceKey('pessoa', true); const outra = deviceKey('outra', true)
    forgetDeviceKey('pessoa')
    expect(deviceKey('pessoa')).toBeNull()
    expect(deviceKey('outra')).toEqual(outra)
  })
})
