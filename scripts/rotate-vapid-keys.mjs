import { spawnSync } from 'node:child_process'
import webpush from 'web-push'
import { rotationPlan } from './vapid-rotation.mjs'

// Gera UM par VAPID e grava o MESMO par nos dois lugares (segredos da Edge Function e banco hospedado), sem passar por copiar e colar.
// A chave privada não é impressa (só vai para o segredo do Supabase); --show-private imprime uma vez, para quem precisa guardá-la.
// Uso: node scripts/rotate-vapid-keys.mjs --subject mailto:voce@email.com [--project <ref>] [--show-private]
const args = process.argv.slice(2)
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const subject = option('--subject')
const project = option('--project') ?? 'hepndavkzuktakezrmsj'
if (!subject) { console.error('Informe --subject mailto:seu@email'); process.exit(1) }
const keys = webpush.generateVAPIDKeys()
const plan = rotationPlan({ publicKey: keys.publicKey, privateKey: keys.privateKey, subject, project })
const quote = value => /[\s']/.test(value) ? `"${value}"` : value
for (const step of plan) {
  console.log(`> ${step.label}…`)
  const run = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', step.args.map(quote), { shell: process.platform === 'win32', encoding: 'utf8' })
  if (run.status !== 0) {
    // Nada do comando (que contém a chave) é repetido na tela.
    console.error(`Falhou em: ${step.label}. ${step.label.startsWith('segredos') ? 'Nada foi alterado no banco.' : 'Os segredos da função já mudaram, o banco ainda não: rode de novo.'}`)
    process.exit(1)
  }
}
console.log(`\nPronto. Chave pública nova: ${keys.publicKey.slice(0, 10)}… (o mesmo par está na função e no banco).`)
if (args.includes('--show-private')) console.log(`Chave privada (guarde agora; não aparece de novo): ${keys.privateKey}`)
console.log('Próximos passos: rodar o autoteste e, no iPhone, Cancelar assinatura e Assinar de novo (a assinatura antiga usa a chave velha).')
