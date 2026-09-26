import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api/index.js'
import { BUSINESS_SLUG } from './config.js'

const BusinessContext = createContext(null)

export function BusinessProvider({ children }) {
  const [business, setBusiness] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const b = await api.getBusiness(BUSINESS_SLUG)
      if (!b) throw new Error(`No business found with slug "${BUSINESS_SLUG}". Did you run the seed?`)
      setBusiness(b)
      setError(null)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (business?.name) document.title = `${business.name} — Book Your Nail Appointment`
  }, [business?.name])

  return (
    <BusinessContext.Provider value={{ business, error, loading, reload, setBusiness }}>
      {children}
    </BusinessContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBusiness() {
  const ctx = useContext(BusinessContext)
  if (!ctx) throw new Error('useBusiness must be used inside <BusinessProvider>')
  return ctx
}
