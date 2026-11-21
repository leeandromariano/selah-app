import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, authMessage } from './auth'
import { disconnectReminderDevice, synchronizeReminderSession } from '../notifications/session'
import { createDiscussionRepository } from '../discussion/repository'

const discussion = createDiscussionRepository(supabase)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [callbackError] = useState(() => new URLSearchParams(location.hash.slice(1)).has('error') ? 'O link de autenticação é inválido ou expirou. Solicite um novo e-mail.' : '')
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const [adminAuthorization, setAdminAuthorization] = useState<{ session: Session; allowed: boolean } | null>(null)
  const [publisherAuthorization, setPublisherAuthorization] = useState<{ session: Session; allowed: boolean } | null>(null)
  const [ownerAuthorization, setOwnerAuthorization] = useState<{ session: Session; allowed: boolean } | null>(null)
  const [error, setError] = useState(callbackError)
  const [googleOnboarding, setGoogleOnboarding] = useState<{ session: Session; status: 'pending' | 'complete' | 'error' } | null>(null)
  useEffect(() => {
    let active = true
    let eventReceived = false
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return
      eventReceived = true
      setAdminAuthorization(null)
      setOwnerAuthorization(null)
      setPublisherAuthorization(null)
      setGoogleOnboarding(null)
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
      supabase.rpc('devotional_open_counts').then(({ error }) => {
        if (active) setAdminAuthorization({ session, allowed: !error })
      }, () => { if (active) setAdminAuthorization({ session, allowed: false }) })
    }
    return () => { active = false }
  }, [session, recovery])
  useEffect(() => {
    let active = true
    if (session && !recovery) {
      discussion.ownerAccess().then(allowed => { if (active) setOwnerAuthorization({ session, allowed }) }, () => { if (active) setOwnerAuthorization({ session, allowed: false }) })
    }
    return () => { active = false }
  }, [session, recovery])
  useEffect(() => {
    let active = true
    if (session && !recovery) {
      supabase.rpc('get_my_publisher_access').then(({ data, error }) => {
        if (active) setPublisherAuthorization({ session, allowed: !error && data === true })
      }, () => { if (active) setPublisherAuthorization({ session, allowed: false }) })
    }
    return () => { active = false }
  }, [session, recovery])
  const googleAccount = Boolean(session?.user.app_metadata?.provider === 'google')
  const googleOnboardingLoading = googleAccount && googleOnboarding?.session !== session
  const googleOnboardingPending = googleAccount && googleOnboarding?.session === session && googleOnboarding.status === 'pending'
  const googleOnboardingError = googleAccount && googleOnboarding?.session === session && googleOnboarding.status === 'error'
  async function refreshGoogleOnboarding() {
    if (!session || !googleAccount) return
    try {
      const { data, error } = await supabase.rpc('get_my_google_onboarding_status')
      if (error || (data !== 'pending' && data !== 'complete')) throw error ?? new Error('Invalid onboarding result')
      setGoogleOnboarding({ session, status: data })
    } catch { setGoogleOnboarding({ session, status: 'error' }) }
  }
  useEffect(() => {
    if (!session || !googleAccount || recovery) return
    let active = true
    supabase.rpc('get_my_google_onboarding_status').then(({ data, error }) => {
      if (active) setGoogleOnboarding({ session, status: !error && (data === 'pending' || data === 'complete') ? data : 'error' })
    }, () => { if (active) setGoogleOnboarding({ session, status: 'error' }) })
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
      setSession(null); setAdminAuthorization(null); setOwnerAuthorization(null); setPublisherAuthorization(null); setGoogleOnboarding(null); setRecovery(false); location.hash = 'login'
    } catch (error) { setError(authMessage(error)) }
  }
  return <AuthContext.Provider value={{ session, loading, recovery, admin: Boolean(session && adminAuthorization?.session === session && adminAuthorization.allowed), adminLoading: Boolean(session && !recovery && adminAuthorization?.session !== session), owner: Boolean(session && !recovery && ownerAuthorization?.session === session && ownerAuthorization.allowed), ownerLoading: Boolean(session && !recovery && ownerAuthorization?.session !== session), publisher: Boolean(session && !recovery && publisherAuthorization?.session === session && publisherAuthorization.allowed), publisherLoading: Boolean(session && !recovery && publisherAuthorization?.session !== session), googleOnboardingLoading, googleOnboardingPending, googleOnboardingError, refreshGoogleOnboarding, error, logout, finishRecovery: () => setRecovery(false) }}>{children}</AuthContext.Provider>
}
