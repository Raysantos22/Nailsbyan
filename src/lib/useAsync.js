import { useCallback, useEffect, useRef, useState } from 'react'

// Run an async loader when deps change; exposes { data, error, loading, reload }.
// Stale responses (from an older set of deps) are ignored.
export function useAsync(loader, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: enabled })
  const callId = useRef(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps)

  const reload = useCallback(async () => {
    const id = ++callId.current
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await run()
      if (id === callId.current) setState({ data, error: null, loading: false })
      return data
    } catch (error) {
      if (id === callId.current) setState((s) => ({ ...s, error, loading: false }))
    }
  }, [run])

  useEffect(() => {
    if (enabled) reload()
    else setState({ data: undefined, error: null, loading: false })
  }, [reload, enabled])

  return { ...state, reload, setData: (data) => setState((s) => ({ ...s, data })) }
}
