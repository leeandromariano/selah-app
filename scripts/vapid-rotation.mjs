// Monta os dois comandos da troca de chaves VAPID. Puro: não executa nada e não imprime nada.
// Valida o formato de tudo antes de montar, porque os valores entram numa linha de comando.
export function rotationPlan({ publicKey, privateKey, subject, project }) {
  if (!/^[A-Za-z0-9_-]{87}$/.test(publicKey ?? '') || !/^[A-Za-z0-9_-]{43}$/.test(privateKey ?? '')
    || !/^mailto:[^\s"'&|<>^%]+@[^\s"'&|<>^%]+$/.test(subject ?? '') || !/^[a-z0-9]{20}$/.test(project ?? '')) throw Error('Valores da troca de chaves inválidos')
  return [
    // Primeiro os segredos da função; só se funcionarem o banco recebe a pública nova (nunca fica um par pela metade no banco).
    { label: 'segredos da função send-reminders', args: ['supabase', 'secrets', 'set', `SELAH_VAPID_PUBLIC_KEY=${publicKey}`, `SELAH_VAPID_PRIVATE_KEY=${privateKey}`, `SELAH_VAPID_SUBJECT=${subject}`, '--project-ref', project] },
    { label: 'chave pública no banco', args: ['supabase', 'db', 'query', '--linked', `update private.push_configuration set vapid_public_key='${publicKey}' where singleton`] },
  ]
}
