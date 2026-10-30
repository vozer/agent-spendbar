import { useRef, useState } from 'react'

import { CliErrorPanel } from '../components/CliErrorPanel'
import { ConnectAffordance } from '../components/ConnectAffordance'
import { Panel } from '../components/Panel'
import { ProviderLogo, hasProviderLogo } from '../components/ProviderLogo'
import { SectionSkeleton } from '../components/Skeleton'
import type { Section } from '../components/Sidebar'
import { BarNav } from '../components/TopBar'
import { usePolled } from '../hooks/usePolled'
import { t } from '../i18n'
import { formatResetTime } from '../lib/format'
import { codeburn } from '../lib/ipc'
import { motionClass } from '../lib/motion'
import { PROVIDER_NAMES, PROVIDER_OWNERS, readDisabledProviders } from '../lib/providers'
import type { Period, QuotaProvider, QuotaWindow } from '../lib/types'
import type { SettingsPane } from './Settings'

/** Honest copy for a 429 backoff window (the upstream quota endpoint rate
 *  limited us), replacing the generic "waiting" note. */
export function rateLimitedNote(provider: QuotaProvider['provider']): string {
  return t('plans.quota.rateLimited', { owner: PROVIDER_OWNERS[provider] })
}

// A single anomalous poll must not flip a live provider to "disconnected". A
// slow/empty serve drops the provider from the array, and a cold or aborted
// read can momentarily report `disconnected`; either one, rendered verbatim,
// flickers a connected row to the Connect affordance and back. So we hold the
// last known status per provider and require `disconnected` to be reported this
// many consecutive polls before the row actually shows it. Other honest states
// (transientFailure/stale/rate-limited/accessDenied) pass through unchanged.
const DISCONNECT_DEBOUNCE = 2
// A provider stuck "waiting" (transientFailure/stale, not rate limited) never
// resolves on its own — the quota service just re-serves the same cached failure
// — so past this cap we stop showing an open-ended spinner and surface an
// actionable, terminal state (Connect + Refresh). The steady poll is 30–60s and
// already cheap (5-min service cache, no repeated spawn), so this only changes
// the copy, not the fetch cadence. Comfortably clears a normal 1–2s answer.
const WAITING_CAP_MS = 20_000

type QuotaKnown = { last: QuotaProvider; strikes: number; waitingSince?: number }

function isWaiting(quota: QuotaProvider): boolean {
  return (quota.connection === 'transientFailure' || quota.connection === 'stale') && !quota.rateLimited
}

export function stabilizeQuota(raw: QuotaProvider[], known: Map<QuotaProvider['provider'], QuotaKnown>, now: number): QuotaProvider[] {
  const out: QuotaProvider[] = []
  const seen = new Set<QuotaProvider['provider']>()
  for (const provider of raw) {
    seen.add(provider.provider)
    const prev = known.get(provider.provider)
    if (provider.connection === 'connected') {
      known.set(provider.provider, { last: provider, strikes: 0 })
      out.push(provider)
      continue
    }
    // Only debounce a provider we last saw connected reporting `disconnected`;
    // a provider that was never connected shows disconnected immediately.
    if (provider.connection === 'disconnected' && prev?.last.connection === 'connected') {
      const strikes = prev.strikes + 1
      if (strikes < DISCONNECT_DEBOUNCE) {
        known.set(provider.provider, { last: prev.last, strikes })
        out.push(prev.last)
        continue
      }
    }
    if (isWaiting(provider)) {
      // A provider that has already shown real numbers keeps them through a
      // transient miss (e.g. a manual Refresh where the serve was busy bringing
      // another provider online): never blank connected bars back to "Waiting…".
      if (prev?.last.connection === 'connected') {
        known.set(provider.provider, { last: prev.last, strikes: 0 })
        out.push(prev.last)
        continue
      }
      // A genuinely cold provider that has never returned data shows "Waiting…",
      // and past the cap escalates to a terminal, actionable error rather than
      // spinning forever.
      const waitingSince = prev?.waitingSince ?? now
      if (now - waitingSince >= WAITING_CAP_MS) {
        known.set(provider.provider, { last: provider, strikes: 0, waitingSince })
        out.push({ ...provider, connection: 'terminalFailure', connectable: true, footerLines: [t('plans.quota.couldNotReach', { name: PROVIDER_NAMES[provider.provider] })] })
        continue
      }
      known.set(provider.provider, { last: provider, strikes: 0, waitingSince })
      out.push(provider)
      continue
    }
    known.set(provider.provider, { last: provider, strikes: 0 })
    out.push(provider)
  }
  // A provider missing from this poll (empty/slow serve) is a transient miss,
  // never a disconnect: keep its last known row.
  for (const [provider, entry] of known) {
    if (!seen.has(provider)) out.push(entry.last)
  }
  return out
}

function useStableQuota(raw: QuotaProvider[] | null): QuotaProvider[] | null {
  const known = useRef(new Map<QuotaProvider['provider'], QuotaKnown>())
  const lastRaw = useRef<QuotaProvider[] | null | undefined>(undefined)
  const stable = useRef<QuotaProvider[] | null>(null)
  if (raw !== lastRaw.current) {
    lastRaw.current = raw
    if (raw) stable.current = stabilizeQuota(raw, known.current, Date.now())
  }
  return raw === null ? null : stable.current
}

export function Plans({ refreshToken = 0 }: { period: Period; refreshToken?: number; onNavigate?: (section: Section, pane?: SettingsPane) => void; ready?: boolean }) {
  // Force a fresh fetch (bypassing QuotaService's 5-min cache, and its keychain
  // guard) when the user hits ⌘R or clicks Refresh in the Connect affordance;
  // the steady 30s poll keeps serving cached quota.
  const [reconnectNonce, setReconnectNonce] = useState(0)
  const lastForced = useRef(`${refreshToken}:${reconnectNonce}`)
  const disabledProviders = readDisabledProviders()
  const quotaMemoKey = `quota|${[...disabledProviders].sort().join(',')}`
  const quota = usePolled<QuotaProvider[]>(() => {
    const key = `${refreshToken}:${reconnectNonce}`
    const force = key !== lastForced.current
    lastForced.current = key
    return codeburn.getQuota(force, disabledProviders)
  }, [refreshToken, reconnectNonce, quotaMemoKey], { memoKey: quotaMemoKey })
  const reconnect = () => setReconnectNonce(value => value + 1)
  const stableQuota = useStableQuota(quota.data)

  return (
    <>
      <div className="bar">
        <BarNav />
        <h1 className="t">{t('plans.title')}</h1>
      </div>
      <div className={motionClass('body', 'section-fade')}>
        {renderQuota(stableQuota, quota.error, reconnect)}
      </div>
    </>
  )
}

function renderQuota(data: QuotaProvider[] | null, error: ReturnType<typeof usePolled<QuotaProvider[]>>['error'], onReconnect: () => void) {
  if (!data) {
    if (error) {
      return (
        <Panel title={t('plans.quota.panelTitle')}>
          <p className="quota-connection-note quota-terminal">{t('plans.quota.unavailable')}</p>
        </Panel>
      )
    }
    return <SectionSkeleton label={t('plans.quota.loading')} rows={3} />
  }

  if (data.length === 0) {
    return (
      <Panel title={t('plans.quota.panelTitle')}>
        <p className="quota-connection-note">{t('plans.quota.noProviders')}</p>
      </Panel>
    )
  }

  return (
    <div className="plans-grid">
      {data.map(provider => <QuotaPanel key={provider.provider} quota={provider} onReconnect={onReconnect} />)}
    </div>
  )
}

/** The provider's own logo, embossed large and faint into the card's
 *  bottom-right — the menu-bar plugin-card wordmark treatment. Providers with no
 *  logo asset get no background art rather than an invented one. */
function CardEmboss({ provider }: { provider: string }) {
  if (!hasProviderLogo(provider)) return null
  return <div className="plan-card-art" aria-hidden><ProviderLogo provider={provider} size={132} /></div>
}

function QuotaPanel({ quota, onReconnect }: { quota: QuotaProvider; onReconnect: () => void }) {
  const providerName = PROVIDER_NAMES[quota.provider]
  return (
    <Panel
      className="quota-card"
      title={<span className="quota-title">{providerName}{quota.planLabel ? <small>{quota.planLabel}</small> : null}</span>}
      right={<ConnectionIndicator connection={quota.connection} />}
    >
      <CardEmboss provider={quota.provider} />
      <QuotaContent quota={quota} onReconnect={onReconnect} />
    </Panel>
  )
}

const CONNECTION_LABEL_KEYS: Record<QuotaProvider['connection'], string> = {
  connected: 'plans.quota.status.connected',
  disconnected: 'plans.quota.status.disconnected',
  keychainUnchecked: 'plans.quota.status.notChecked',
  accessDenied: 'plans.quota.status.locked',
  loading: 'plans.quota.status.loading',
  stale: 'plans.quota.status.stale',
  transientFailure: 'plans.quota.status.waiting',
  terminalFailure: 'plans.quota.status.error',
}

function ConnectionIndicator({ connection }: { connection: QuotaProvider['connection'] }) {
  const label = t(CONNECTION_LABEL_KEYS[connection])
  return <span className={`quota-connection quota-connection-${connection}`}><i />{label}</span>
}

function QuotaContent({ quota, onReconnect }: { quota: QuotaProvider; onReconnect: () => void }) {
  // Not "logged out": we have not read the login yet. Offer the read instead of
  // instructions for a login the user has probably already done.
  if (quota.connection === 'keychainUnchecked') {
    return (
      <div className="quota-connect">
        <span className="quota-connection-note">{t('plans.quota.notChecked.line', { name: PROVIDER_NAMES[quota.provider] })}</span>
        <button type="button" className="btnp btnp-primary" onClick={onReconnect}>{t('plans.quota.notChecked.action')}</button>
        <span className="quota-connection-note">{t('plans.quota.notChecked.keychainNote')}</span>
      </div>
    )
  }
  if (quota.connection === 'disconnected' || quota.connection === 'accessDenied') {
    return <ConnectAffordance provider={quota.provider} connection={quota.connection} onRefresh={onReconnect} />
  }
  if (quota.connection === 'loading') return <p className="quota-connection-note">{t('plans.quota.loading')}</p>
  if (quota.connection === 'stale' || quota.connection === 'transientFailure') {
    if (quota.rateLimited) return <p className="quota-connection-note">{rateLimitedNote(quota.provider)}</p>
    return <p className="quota-connection-note">{t('plans.quota.waitingOnCli')}</p>
  }
  if (quota.connection === 'terminalFailure') {
    // An auth expiry (or a capped "waiting") is recoverable: show the same
    // Connect affordance the disconnected state uses, keeping the error line.
    if (quota.connectable) {
      return <ConnectAffordance provider={quota.provider} connection="disconnected" onRefresh={onReconnect} message={quota.footerLines[0]} />
    }
    // A genuinely terminal provider (a retired Gemini tier, no allowance) says
    // why; the generic line is the fallback. No action to offer.
    return <p className="quota-connection-note quota-terminal">{quota.footerLines[0] ?? t('plans.quota.unavailableGeneric')}</p>
  }

  return (
    <>
      <div className="quota-windows">
        {quota.details.map((window, index) => <QuotaMeter key={`${window.label}-${index}`} window={window} />)}
      </div>
      {quota.footerLines.length > 0 ? (
        <div className="quota-footer">{quota.footerLines.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</div>
      ) : null}
    </>
  )
}

function QuotaMeter({ window }: { window: QuotaWindow }) {
  const percent = Math.round(window.percent * 100)
  const severity = window.percent >= 0.9 ? 'bad' : window.percent >= 0.7 ? 'warn' : 'accent'
  const reset = formatResetTime(window.resetsAt)
  return (
    <div className="quota-window">
      <div className="quota-window-labels">
        <span>{window.label}</span>
        <span>{reset ? t('plans.quota.usedWithReset', { percent, reset }) : t('plans.quota.used', { percent })}</span>
      </div>
      <div className="track" data-testid={`quota-track-${window.label}`}>
        <i className={severity} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
    </div>
  )
}
