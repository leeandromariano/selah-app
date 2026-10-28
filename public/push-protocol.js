/* Shared service-worker protocol. No external URLs or caller supplied text. */
globalThis.SelahPush = (() => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  function notification(payload, binding, now = new Date()) {
    if (!payload || payload.v !== 1 || !uuid.test(binding || '') || payload.binding !== binding) return null
    if (payload.kind === 'verify' && uuid.test(payload.proof || '')) return {
      title: 'Confirme os lembretes do Selah', body: 'Volte às configurações para concluir a ativação.', path: '/#configuracoes', proof: payload.proof,
    }
    if (!['reading', 'share'].includes(payload.kind) || !uuid.test(payload.devotional || '') || !/^\d{4}-\d{2}-\d{2}$/.test(payload.day || '')) return null
    // Drop late delivery across BRT midnight. This is a stale-message guard,
    // never a browser decision about valid reading completion.
    if (new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now)) !== payload.day) return null
    return {
      title: payload.kind === 'reading' ? 'Seu momento com Deus está esperando!' : 'Que tal compartilhar a Palavra hoje?',
      body: payload.kind === 'reading' ? 'Que tal separar alguns minutos para a Palavra hoje?' : 'Convide um amigo para conhecer o devocional de hoje.',
      path: '/#leitura/' + payload.devotional + (payload.kind === 'share' ? '/compartilhar' : ''),
    }
  }
  function safePath(path) { return path === '/#configuracoes' || /^\/#leitura\/[0-9a-f-]{36}(\/compartilhar)?$/i.test(path || '') }
  return { notification, safePath }
})()
