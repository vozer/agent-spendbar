import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ProviderLogo } from './components/ProviderLogo'
import { codeburn } from './lib/ipc'
import type { MenubarPayload } from './lib/types'
import { monthlyBudgetPercentages } from '../../src/monthly-budgets'

export function MonthlyUsageApp() {
  const [payload, setPayload] = useState<MenubarPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const inFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setLoading(true)
    try {
      setPayload(await codeburn.getOverview('month', 'all'))
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      inFlight.current = false
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
    <main className="monthly-usage-app">
      <section className="monthly-usage-panel" aria-labelledby="monthly-usage-title">
        <header className="monthly-usage-header">
          <div>
            <h1 id="monthly-usage-title">Monthly usage</h1>
            <p>{payload?.current.label ?? 'Calendar month to date'}</p>
          </div>
          <button type="button" onClick={() => { void refresh() }} disabled={loading} aria-label="Refresh monthly usage">
            {loading ? '…' : 'Refresh'}
          </button>
        </header>

        {failed && <p className="monthly-usage-message" role="alert">Usage could not be loaded. Try refreshing.</p>}
        {!payload && loading && <p className="monthly-usage-message" role="status">Loading this month’s usage…</p>}

        <div className="monthly-usage-list">
          {items.map(item => (
            <article className="monthly-usage-item" key={item.id}>
              <div className="monthly-usage-item-head">
                <span className="monthly-usage-provider"><ProviderLogo provider={item.id} size={22} />{item.label}</span>
                <strong className={item.value !== null && item.value > 100 ? 'over' : undefined}>{item.percentage}</strong>
              </div>
              {item.value !== null && (
                <div
                  className="monthly-usage-track"
                  role="progressbar"
                  aria-label={`${item.label} monthly usage`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, Math.max(0, item.value))}
                >
                  <span className={item.value > 100 ? 'over' : undefined} style={{ width: `${Math.min(100, Math.max(0, item.value))}%` }} />
                </div>
              )}
            </article>
          ))}
        </div>

        <p className="monthly-usage-note">Percent of monthly budget used. A tilde marks estimated or partial data.</p>
      </section>
    </main>
  )
}
