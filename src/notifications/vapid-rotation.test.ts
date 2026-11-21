import { describe, expect, it } from 'vitest'
// @ts-expect-error Módulo de servidor em JavaScript, fora do grafo do frontend.
import { rotationPlan } from '../../scripts/vapid-rotation.mjs'

const publicKey = 'B'.repeat(87), privateKey = 'p'.repeat(43), subject = 'mailto:operador@example.invalid', project = 'abcdefghij0123456789'

describe('troca de chaves VAPID', () => {
  it('grava o mesmo par nos segredos da função e a pública no banco, nessa ordem', () => {
    const [secrets, database] = rotationPlan({ publicKey, privateKey, subject, project })
    expect(secrets.args).toEqual(['supabase', 'secrets', 'set', `SELAH_VAPID_PUBLIC_KEY=${publicKey}`, `SELAH_VAPID_PRIVATE_KEY=${privateKey}`, `SELAH_VAPID_SUBJECT=${subject}`, '--project-ref', project])
    expect(database.args.slice(0, 4)).toEqual(['supabase', 'db', 'query', '--linked'])
    expect(database.args[4]).toBe(`update private.push_configuration set vapid_public_key='${publicKey}' where singleton`)
  })
  it('a chave privada nunca vai para o comando do banco', () => {
    const [, database] = rotationPlan({ publicKey, privateKey, subject, project })
    expect(JSON.stringify(database)).not.toContain(privateKey)
  })
  it.each([
    ['pública curta', { publicKey: 'x' }], ['privada com caractere inválido', { privateKey: 'p'.repeat(42) + '&' }],
    ['assunto sem mailto', { subject: 'https://exemplo.invalid' }], ['assunto com aspas', { subject: 'mailto:a"b@example.invalid' }],
    ['projeto inválido', { project: 'x; rm -rf' }],
  ])('recusa valores inválidos: %s (entram numa linha de comando)', (_name, bad) => {
    expect(() => rotationPlan({ publicKey, privateKey, subject, project, ...bad })).toThrow('inválidos')
  })
})
