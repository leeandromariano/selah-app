/* Shared service-worker protocol. No external URLs or caller supplied text. */
globalThis.SelahPush = (() => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  function notification(payload, binding, now = new Date()) {
    if (!payload || payload.v !== 1 || !uuid.test(binding || '') || payload.binding !== binding) return null
    if (payload.kind === 'verify' && uuid.test(payload.proof || '')) return {
      title: 'Confirme os lembretes do Coram', body: 'Volte às configurações para concluir a ativação.', path: '/#configuracoes', proof: payload.proof,
    }
    // Lembrete da cápsula de oração: texto fixo, sem devocional e sem nada do pedido; abre a Home.
    if (payload.kind === 'prayer' && /^\d{4}-\d{2}-\d{2}$/.test(payload.day || '') && !('devotional' in payload)) {
      if (new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now)) !== payload.day) return null
      return { title: 'Cápsula de oração', body: 'Chegou a hora de rever um pedido de oração. Como Deus agiu?', path: '/#inicio' }
    }
    // Devocional nova publicada: texto fixo; leva só o id da devocional e abre a leitura.
    if (payload.kind === 'new' && uuid.test(payload.devotional || '') && /^\d{4}-\d{2}-\d{2}$/.test(payload.day || '')) {
      if (new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now)) !== payload.day) return null
      return { title: 'Devocional nova no Coram', body: 'Uma nova devocional acabou de ser publicada. Que tal ler agora?', path: '/#leitura/' + payload.devotional }
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
  function safePath(path) { return path === '/#configuracoes' || path === '/#inicio' || /^\/#leitura\/[0-9a-f-]{36}(\/compartilhar)?$/i.test(path || '') }
  return { notification, safePath }
})()
