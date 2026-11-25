import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, authMessage } from './auth'
import { disconnectReminderDevice, synchronizeReminderSession } from '../notifications/session'
import { createDiscussionRepository } from '../discussion/repository'
import { clearFormDrafts } from '../admin/formDraft'

const discussion = createDiscussionRepository(supabase)

// A permissão fica ligada à conta, não ao objeto de sessão: ao voltar para a aba o Supabase reemite a sessão, e a nova
// conferência roda por trás, sem desmontar as telas (e sem apagar o que estava sendo digitado nelas).
type Authorization = { userId: string; allowed: boolean }
const denied = (error: unknown) => (error as { code?: string } | null)?.code === '42501'
// resultado da conferência: sucesso ou recusa valem sempre; uma falha passageira (rede ao reabrir o aparelho) mantém o que
// já tinha sido confirmado para a mesma conta. O servidor continua conferindo cada leitura e gravação.
const settle = (userId: string, allowed: boolean, error: unknown) => (previous: Authorization | null): Authorization =>
  error && !denied(error) && previous?.userId === userId ? previous : { userId, allowed: !error && allowed }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [callbackError] = useState(() => new URLSearchParams(location.hash.slice(1)).has('error') ? 'O link de autenticação é inválido ou expirou. Solicite um novo e-mail.' : '')
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const [adminAuthorization, setAdminAuthorization] = useState<Authorization | null>(null)
  const [publisherAuthorization, setPublisherAuthorization] = useState<Authorization | null>(null)
  const [ownerAuthorization, setOwnerAuthorization] = useState<Authorization | null>(null)
  const [error, setError] = useState(callbackError)
  const [googleOnboarding, setGoogleOnboarding] = useState<{ userId: string; status: 'pending' | 'complete' | 'error' } | null>(null)
  useEffect(() => {
    let active = true
    let eventReceived = false
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return
      eventReceived = true
      // só zera quando a conta muda, sai ou entra em recuperação de senha
      const keep = <T extends { userId: string }>(previous: T | null) => next && event !== 'PASSWORD_RECOVERY' && previous?.userId === next.user.id ? previous : null
      setAdminAuthorization(keep)
      setOwnerAuthorization(keep)
      setPublisherAuthorization(keep)
      setGoogleOnboarding(keep)
      setSession(next ? { ...next } : null)
      setLoading(false)
      setError(next ? '' : callbackError)
      if (event === 'PASSWORD_RECOVERY') { setRecovery(true); location.hash = 'nova-senha' }
      if (event === 'SIGNED_IN' && (location.hash === '#login' || location.hash === '#cadastro' || location.hash.includes('access_token='))) location.hash = 'inicio'
      if (event === 'SIGNED_OUT') setRecovery(false)
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active || eventReceived) return
      setSession(error ? null : data.session)
      setError(error ? authMessage(error) : callbackError)
      setLoading(false)
    }).catch(error => { if (active && !eventReceived) { setError(authMessage(error)); setLoading(false) } })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [callbackError])
  useEffect(() => {
    let active = true
    if (session && !recovery) {
      // The server authorizes this RPC using private membership, never user metadata.
      const userId = session.user.id
      supabase.rpc('devotional_open_counts').then(({ error }) => {
        if (active) setAdminAuthorization(settle(userId, true, error))
      }, error => { if (active) setAdminAuthorization(settle(userId, false, error ?? true)) })
    }
    return () => { active = false }
  }, [session, recovery])
  useEffect(() => {
    let active = true
    if (session && !recovery) {
      const userId = session.user.id
      discussion.ownerAccess().then(allowed => { if (active) setOwnerAuthorization(settle(userId, allowed, null)) }, error => { if (active) setOwnerAuthorization(settle(userId, false, error ?? true)) })
    }
    return () => { active = false }
  }, [session, recovery])
  useEffect(() => {
    let active = true
    if (session && !recovery) {
      const userId = session.user.id
      supabase.rpc('get_my_publisher_access').then(({ data, error }) => {
        if (active) setPublisherAuthorization(settle(userId, data === true, error))
      }, error => { if (active) setPublisherAuthorization(settle(userId, false, error ?? true)) })
    }
    return () => { active = false }
  }, [session, recovery])
  const googleAccount = Boolean(session?.user.app_metadata?.provider === 'google')
  const userId = session?.user.id
  const googleOnboardingLoading = googleAccount && googleOnboarding?.userId !== userId
  const googleOnboardingPending = googleAccount && googleOnboarding?.userId === userId && googleOnboarding?.status === 'pending'
  const googleOnboardingError = googleAccount && googleOnboarding?.userId === userId && googleOnboarding?.status === 'error'
  async function refreshGoogleOnboarding() {
    if (!session || !googleAccount) return
    try {
      const { data, error } = await supabase.rpc('get_my_google_onboarding_status')
      if (error || (data !== 'pending' && data !== 'complete')) throw error ?? new Error('Invalid onboarding result')
      setGoogleOnboarding({ userId: session.user.id, status: data })
    } catch { setGoogleOnboarding({ userId: session.user.id, status: 'error' }) }
  }
  useEffect(() => {
    if (!session || !googleAccount || recovery) return
    let active = true
    const id = session.user.id
    // falha passageira numa conferência repetida mantém o cadastro já confirmado desta conta
    const failed = () => setGoogleOnboarding(previous => previous?.userId === id && previous.status === 'complete' ? previous : { userId: id, status: 'error' })
    supabase.rpc('get_my_google_onboarding_status').then(({ data, error }) => {
      if (!active) return
      if (!error && (data === 'pending' || data === 'complete')) setGoogleOnboarding({ userId: id, status: data }); else failed()
    }, () => { if (active) failed() })
    return () => { active = false }
  }, [session, googleAccount, recovery])
  const reminderUser = session && !recovery && !googleOnboardingLoading && !googleOnboardingPending && !googleOnboardingError ? session.user.id : null
  useEffect(() => { synchronizeReminderSession(reminderUser) }, [reminderUser])
  async function logout() {
    setError('')
    try {
      if (session) await disconnectReminderDevice(session.user.id)
      // Escopo local: sair neste aparelho não pode derrubar as sessões da conta em outros aparelhos (o padrão é global).
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      clearFormDrafts()
      setSession(null); setAdminAuthorization(null); setOwnerAuthorization(null); setPublisherAuthorization(null); setGoogleOnboarding(null); setRecovery(false); location.hash = 'login'
    } catch (error) { setError(authMessage(error)) }
  }
  return <AuthContext.Provider value={{ session, loading, recovery, admin: Boolean(session && adminAuthorization?.userId === session?.user.id && adminAuthorization?.allowed), adminLoading: Boolean(session && !recovery && adminAuthorization?.userId !== session?.user.id), owner: Boolean(session && !recovery && ownerAuthorization?.userId === session?.user.id && ownerAuthorization?.allowed), ownerLoading: Boolean(session && !recovery && ownerAuthorization?.userId !== session?.user.id), publisher: Boolean(session && !recovery && publisherAuthorization?.userId === session?.user.id && publisherAuthorization?.allowed), publisherLoading: Boolean(session && !recovery && publisherAuthorization?.userId !== session?.user.id), googleOnboardingLoading, googleOnboardingPending, googleOnboardingError, refreshGoogleOnboarding, error, logout, finishRecovery: () => setRecovery(false) }}>{children}</AuthContext.Provider>
}
