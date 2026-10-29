import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, authMessage } from './auth'
import { disconnectReminderDevice, synchronizeReminderSession } from '../notifications/session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [callbackError] = useState(() => new URLSearchParams(location.hash.slice(1)).has('error') ? 'O link de autenticação é inválido ou expirou. Solicite um novo e-mail.' : '')
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const [adminAuthorization, setAdminAuthorization] = useState<{ session: Session; allowed: boolean } | null>(null)
  const [error, setError] = useState(callbackError)
  useEffect(() => {
    let active = true
    let eventReceived = false
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return
      eventReceived = true
      setAdminAuthorization(null)
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
  const reminderUser = session && !recovery ? session.user.id : null
  useEffect(() => { synchronizeReminderSession(reminderUser) }, [reminderUser])
  async function logout() {
    setError('')
    try {
      if (session) await disconnectReminderDevice(session.user.id)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setSession(null); setAdminAuthorization(null); setRecovery(false); location.hash = 'login'
    } catch (error) { setError(authMessage(error)) }
  }
  return <AuthContext.Provider value={{ session, loading, recovery, admin: Boolean(session && adminAuthorization?.session === session && adminAuthorization.allowed), adminLoading: Boolean(session && !recovery && adminAuthorization?.session !== session), error, logout, finishRecovery: () => setRecovery(false) }}>{children}</AuthContext.Provider>
}
