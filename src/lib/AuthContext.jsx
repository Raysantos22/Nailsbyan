import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api/index.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}
    api.getSession().then((s) => {
      if (!active) return
      setSession(s)
      setReady(true)
    })
    api.onAuthChange((s) => active && setSession(s)).then((unsub) => {
      if (active) unsubscribe = unsub
      else unsub()
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, ready }}>{children}</AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
