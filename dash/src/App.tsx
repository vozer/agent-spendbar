import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchUsage, type Payload } from '@/lib/api'
import { monthlyBudgetPercentages } from '../../src/monthly-budgets'

export function App() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setPayload(await fetchUsage('month', 'all'))
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 5 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const items = useMemo(() => monthlyBudgetPercentages(payload), [payload])

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 bg-background p-6 text-foreground">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-heading">Monthly usage</h1>
          <p className="mt-1 text-sm text-muted-foreground">{payload?.current.label ?? 'Calendar month to date'}</p>
        </div>
        <button className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-interactive-secondary disabled:opacity-50" type="button" onClick={() => { void refresh() }} disabled={loading}>
          {loading ? '…' : 'Refresh'}
        </button>
      </header>

      {failed && <p className="text-sm text-brand" role="alert">Usage could not be loaded. Try refreshing.</p>}
      {!payload && loading && <p className="text-sm text-muted-foreground" role="status">Loading this month’s usage…</p>}

      <section className="flex flex-col gap-5" aria-label="Monthly provider usage">
        {items.map(item => (
          <article key={item.id}>
            <div className="flex items-center justify-between gap-4">
              <span className="text-base font-medium">{item.label}</span>
              <strong className="font-mono text-2xl tabular-nums">{item.percentage}</strong>
            </div>
            {item.value !== null && (
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`${item.label} monthly usage`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.max(0, item.value))}
              >
                <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, item.value))}%` }} />
              </div>
            )}
          </article>
        ))}
      </section>

      <p className="text-xs text-muted-foreground">Percent of monthly budget used. A tilde marks estimated or partial data.</p>
    </main>
  )
}
