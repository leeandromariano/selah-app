import { useEffect, useState } from 'react'
import { hasInstallPrompt, isAppInstalled, isIos, subscribeInstall, takeInstallPrompt } from '../lib/installPrompt'

export function InstallApp() {
  const [, refresh] = useState(0)
  const [help, setHelp] = useState(false)
  useEffect(() => subscribeInstall(() => refresh(n => n + 1)), [])
  if (isAppInstalled()) return null

  async function install() {
    if (!hasInstallPrompt()) { setHelp(open => !open); return }
    const event = takeInstallPrompt()
    await event?.prompt()
    await event?.userChoice
  }

  return <section className="install-app" aria-label="Instalar o Coram como aplicativo">
    <img src="/coram-icon-192.png" alt="" />
    <div className="install-app-text">
      <h2>Instale o Coram no seu celular</h2>
      <p>Abra direto da tela inicial, sem navegador, como um aplicativo.</p>
    </div>
    <button type="button" className="button primary" onClick={() => void install()} aria-expanded={help}>Instalar app</button>
    {help && <p className="install-help" role="status">{isIos()
      ? 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.'
      : 'No menu do navegador (⋮), escolha “Instalar app” ou “Adicionar à tela inicial”.'}</p>}
  </section>
}
