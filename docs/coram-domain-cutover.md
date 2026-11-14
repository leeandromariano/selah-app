# Domínio principal do Coram — roteiro de migração

Destino autorizado pelo responsável: `https://appcoram.com.br`, com `www.appcoram.com.br` redirecionado para o domínio sem `www`. O projeto Pages continua `selah-staging`, e o Supabase principal continua `selah-staging` (`hepndavkzuktakezrmsj`). Este documento é preparação; a mudança de DNS e a publicação do novo build exigem aprovação do candidato concreto conforme `AGENTS.md`.

## Estado observado antes da mudança

- O site principal funciona em `https://selah-staging.pages.dev`.
- O DNS público de `appcoram.com.br` usa `a.auto.dns.br` e `b.auto.dns.br` do Registro.br. Não foram encontrados registros A ou AAAA no domínio raiz. Foi encontrado um registro DS, indicando DNSSEC na delegação. Conferir os registros completos no painel antes da troca.
- O build hospedado e a função da Bíblia aceitam hoje apenas a origem `selah-staging.pages.dev`; apontar DNS sem atualizar essas configurações deixaria o app ou a Bíblia indisponíveis no novo domínio.

## Sequência segura

1. Revisar no Registro.br todos os registros em uso (inclusive MX, TXT e subdomínios) e reproduzir os necessários na futura zona Cloudflare antes da troca de nameservers. Não copiar dados pessoais para testes.
2. Adicionar `appcoram.com.br` como zona na mesma conta Cloudflare do Pages. Usar o plano apropriado e anotar os dois nameservers atribuídos pela Cloudflare; não inventar seus nomes.
3. No Supabase Auth do projeto principal, adicionar `https://appcoram.com.br` e `https://appcoram.com.br/` conforme os campos exatos da lista de Redirect URLs; manter a URL antiga durante a transição. Atualizar Site URL para o novo endereço somente após o domínio funcionar. No cliente OAuth do Google, acrescentar `https://appcoram.com.br` às origens JavaScript autorizadas; o callback Supabase permanece o mesmo.
4. Configurar no Pages de produção `BIBLE_ADDITIONAL_SITE_ORIGIN=https://appcoram.com.br`. Publicar o build STAGING com `VITE_STAGING_SITE_ORIGIN=https://selah-staging.pages.dev` e `VITE_STAGING_ADDITIONAL_SITE_ORIGIN=https://appcoram.com.br`, mantendo os sinais da Bíblia e do devocional guiado. O build de prévia não recebe a origem adicional. Verificar que o endereço antigo continua funcionando antes da troca de DNS.
5. Associar `appcoram.com.br` em **Pages > Custom domains**. Para o domínio raiz, a Cloudflare exige que sua zona seja autoritativa. No Registro.br, remover/desativar o DS antigo e aguardar sua expiração antes de trocar os nameservers. Substituir os nameservers pelos dois atribuídos à zona Cloudflare. Depois da ativação, reativar DNSSEC usando os dados da Cloudflare no Registro.br.
6. Confirmar HTTPS, título, manifesto PWA, login por e-mail, login Google, recuperação de senha e Bíblia autenticada no novo domínio. A sessão do navegador e a instalação PWA do domínio antigo não migram entre origens; o leitor precisará entrar novamente.
7. Configurar `www.appcoram.com.br` com DNS proxied e regra de redirecionamento 301 para `https://appcoram.com.br`, preservando caminho e consulta. Verificar `www` e o domínio raiz.
8. Após a validação, tornar o domínio novo a origem canônica do build e manter `selah-staging.pages.dev` como origem adicional enquanto existirem links antigos. Uma futura regra de redirecionamento do Pages poderá levar os links antigos para o domínio principal quando as implicações de sessão e PWA forem aceitas.

## Retorno

Se o novo domínio falhar, manter `selah-staging.pages.dev` como endereço principal enquanto corrige DNS, certificado ou Auth. O build de duas origens preserva esse acesso. Reverter o deploy Pages ao ID anterior à mudança se houver regressão de aplicação. Não remover o DS da Cloudflare nem restaurar nameservers do Registro.br sem reavaliar a cadeia DNSSEC. Alterações de URL em Auth e Google devem ser revertidas de forma explícita, preservando a URL antiga até confirmar o retorno.

Referências oficiais: [Cloudflare Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/), [Cloudflare full DNS setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/), [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls/), [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google/).
