import { useEffect, useMemo, useRef } from 'react'

import { Stat } from './Stat'
import { useEscape } from '../hooks/useEscape'
import { formatCompact, formatCount, formatDayLong, formatDuration, shortenProjectPath } from '../lib/format'
import { DUR, useExitAnimation } from '../lib/motion'
import { codeburn } from '../lib/ipc'
import { contributeRow, type InvestigationFilters } from '../lib/investigation'
import type { ContributionSegment, SessionDrillRow, SessionRow } from '../lib/types'
import { Icon } from './icons'
import { t } from '../i18n'

type UsageRow = { key: string; label: string; count: number; url?: string }
type Breakdowns = { models: UsageRow[]; categories: UsageRow[]; branches: UsageRow[]; days: UsageRow[]; prs: UsageRow[] }

/** Session analytics shown from the Sessions list. The detail keeps activity,
 *  model, token, branch, and pull request data without displaying cost fields. */
export function SessionDrawer({ row, openKey, filters, onClose }: {
  row: SessionDrillRow
  openKey: string
  filters: InvestigationFilters
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const { closing, beginExit } = useExitAnimation(onClose, DUR.slow, openKey)

  useEscape(true, beginExit)

  useEffect(() => {
    const panel = panelRef.current
    panel?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !panel) return
      const focusable = panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  return (
    <>
      <div className={closing ? 'drawer-scrim closing' : 'drawer-scrim'} aria-hidden="true" onClick={beginExit} />
      <aside
        ref={panelRef}
        className={closing ? 'session-drawer closing' : 'session-drawer'}
        role="dialog"
        aria-modal="true"
        aria-label={t('sessions.drawer.ariaLabel', { title: row.title || shortenProjectPath(row.project) })}
        tabIndex={-1}
      >
        <div className="drawer-head">
          <div>
            <h3 className="drawer-title">{row.title || shortenProjectPath(row.project)}</h3>
            <div className="drawer-sub">
              {row.provider} · {shortenProjectPath(row.project)} · <span className="mono">{row.sessionId.slice(0, 18)}</span>
            </div>
            <div className="drawer-sub">
              {formatDayLong(row.startedAt)} → {formatDayLong(row.endedAt)}
              {row.durationMs > 0 && <> · {formatDuration(row.durationMs)}</>}
            </div>
          </div>
          <button type="button" className="drawer-close" aria-label={t('sessions.drawer.closeAriaLabel')} onClick={beginExit}><Icon name="x" /></button>
        </div>

        <SessionDetails row={row} filters={filters} />
      </aside>
    </>
  )
}

export function SessionDetails({ row, filters }: { row: SessionDrillRow; filters: InvestigationFilters }) {
  const breakdown = useMemo(() => buildBreakdowns(row), [row])
  const contribution = useMemo(() => contributeRow(row, filters), [row, filters])
  const calls = contribution?.calls ?? row.calls
  const tokens = contribution?.tokens ?? row.inputTokens + row.outputTokens
  const cacheTotal = row.inputTokens + row.cacheReadTokens
  const cacheHit = cacheTotal > 0 ? Math.round(row.cacheReadTokens / cacheTotal * 100) : 0
  const foldLabel = branchPrLabel(breakdown)

  return (
    <>
      <p className="drawer-lead">
        {formatCount(calls, 'call')} · {formatCompact(tokens)} {t('sessions.summary.tokens')}
        {row.models.length > 0 && <> · {row.models.join(', ')}</>}
      </p>

      <div className="stats drawer-tiles">
        <Stat label={t('sessions.drawer.statTurnsLabel')} value={row.turns.toLocaleString()} delta={formatCount(row.calls, 'call')} />
        <Stat label={t('sessions.drawer.statCallsLabel')} value={row.calls.toLocaleString()} delta={t('sessions.drawer.deltaApiCalls')} />
        <Stat label={t('sessions.drawer.statInputLabel')} value={formatCompact(row.inputTokens)} delta={t('sessions.drawer.deltaTokensSent')} />
        <Stat label={t('sessions.drawer.statOutputLabel')} value={formatCompact(row.outputTokens)} delta={t('sessions.drawer.deltaTokensGenerated')} />
      </div>

      {row.isSidechain && row.parentSessionId && (
        <p className="drawer-note">{t('sessions.drawer.subagentPrefix')}<span className="mono">{row.parentSessionId.slice(0, 18)}</span>.</p>
      )}

      <DrawerBreakdown label={t('sessions.drawer.modelsLabel')} rows={breakdown.models} />
      <DrawerBreakdown label={t('sessions.drawer.categoriesLabel')} rows={breakdown.categories} />

      {row.subagents && row.subagents.length > 0 && <SubagentBreakdown subagents={row.subagents} />}

      <details className="drawer-fold">
        <summary>
          {t('sessions.drawer.tokensSummary', {
            inTok: formatCompact(row.inputTokens),
            outTok: formatCompact(row.outputTokens),
            cacheTok: formatCompact(row.cacheWriteTokens),
            hitPct: cacheHit,
          })}
        </summary>
        <div className="drawer-fold-body">
          <div className="stats">
            <Stat label={t('sessions.drawer.statCacheReadLabel')} value={formatCompact(row.cacheReadTokens)} delta={t('sessions.drawer.deltaCacheHit', { percent: cacheHit })} />
            <Stat label={t('sessions.drawer.statCacheWriteLabel')} value={formatCompact(row.cacheWriteTokens)} delta={t('sessions.drawer.deltaTokensCached')} />
          </div>
        </div>
      </details>

      {foldLabel !== null && (
        <details className="drawer-fold">
          <summary>{t('sessions.drawer.branchesPrsSummary', { label: foldLabel })}</summary>
          <div className="drawer-fold-body">
            <DrawerBreakdown label={t('sessions.drawer.branchesLabel')} rows={breakdown.branches} />
            {breakdown.days.length > 1 && <DrawerBreakdown label={t('sessions.drawer.daysLabel')} rows={breakdown.days} />}
            <DrawerBreakdown label={t('sessions.drawer.prsLabel')} rows={breakdown.prs} link />
          </div>
        </details>
      )}
    </>
  )
}

function SubagentBreakdown({ subagents }: { subagents: SessionRow[] }) {
  const sorted = [...subagents].sort((a, b) => b.calls - a.calls)
  return (
    <details className="drawer-fold">
      <summary>{t('sessions.drawer.subagentsLabel')} · {formatCount(sorted.length, 'session')}</summary>
      <div className="drawer-fold-body">
        {sorted.map(entry => (
          <div className="drawer-breakdown-row" key={entry.sessionId}>
            <span className="drawer-breakdown-label" title={entry.title || entry.sessionId}>{entry.title || entry.sessionId}</span>
            <span>{formatCount(entry.calls, 'call')}</span>
            <span>{formatCompact(entry.inputTokens + entry.outputTokens)} {t('sessions.summary.tokens')}</span>
          </div>
        ))}
      </div>
    </details>
  )
}

function branchPrLabel({ branches, prs }: Pick<Breakdowns, 'branches' | 'prs'>): string | null {
  const parts: string[] = []
  if (branches.length > 0 && !(branches.length === 1 && branches[0]!.label === 'main' && prs.length === 0)) {
    parts.push(branches.slice(0, 2).map(entry => entry.label).join(', '))
  }
  if (prs.length > 0) parts.push(t(prs.length === 1 ? 'sessions.drawer.prCount.one' : 'sessions.drawer.prCount.other', { count: prs.length }))
  return parts.length > 0 ? parts.join(', ') : null
}

function buildBreakdowns(row: SessionDrillRow): Breakdowns {
  const models = new Map<string, number>()
  const categories = new Map<string, number>()
  const branches = new Map<string, number>()
  const days = new Map<string, number>()
  const prs = new Map<string, number>()
  const segments: ContributionSegment[] = row.contributions?.segments ?? []

  for (const segment of segments) {
    for (const [model, usage] of Object.entries(segment.modelUsage ?? {})) {
      models.set(model, (models.get(model) ?? 0) + usage.calls)
    }
    if (segment.category) categories.set(segment.category, (categories.get(segment.category) ?? 0) + segment.calls)
    if (segment.branch) branches.set(segment.branch, (branches.get(segment.branch) ?? 0) + segment.calls)
    if (segment.day) days.set(segment.day, (days.get(segment.day) ?? 0) + segment.calls)
    const share = segment.prs.length > 0 ? segment.calls / segment.prs.length : 0
    for (const url of segment.prs) prs.set(url, (prs.get(url) ?? 0) + share)
  }

  const rows = (values: Map<string, number>, display = (key: string) => key): UsageRow[] =>
    [...values.entries()]
      .map(([key, count]) => ({ key, label: display(key), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

  const modelRows = rows(models, key => key === '' ? t('sessions.drawer.unknownModel') : key)
  if (modelRows.length === 0) {
    for (const model of row.models) modelRows.push({ key: model, label: model, count: 0 })
  }
  const prRows = rows(prs, prLabel).map(entry => ({ ...entry, url: entry.key }))
  return { models: modelRows, categories: rows(categories), branches: rows(branches), days: rows(days), prs: prRows }
}

function prLabel(url: string): string {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(url)
  return match ? `${match[1]}/${match[2]}#${match[3]}` : url
}

function DrawerBreakdown({ label, rows, link = false }: { label: string; rows: UsageRow[]; link?: boolean }) {
  if (rows.length === 0) return null
  const max = Math.max(...rows.map(row => row.count), 0)
  return (
    <div className="drawer-breakdown" role="group" aria-label={t('sessions.drawer.breakdownAriaLabel', { label })}>
      <div className="drawer-breakdown-head">{label}</div>
      {rows.map(entry => (
        <div className="drawer-breakdown-row" key={entry.key}>
          <span className="drawer-breakdown-label" title={entry.url ?? entry.label}>{entry.label}</span>
          <div className="drawer-breakdown-bar" aria-hidden="true"><span style={{ width: `${max > 0 ? entry.count / max * 100 : 0}%` }} /></div>
          {link && entry.url
            ? <a className="drawer-breakdown-cost drawer-link" href={entry.url} onClick={event => { event.preventDefault(); void codeburn.openExternal(entry.url!) }}>{formatCount(Math.round(entry.count), 'call')}</a>
            : <span className="drawer-breakdown-cost">{formatCount(Math.round(entry.count), 'call')}</span>}
        </div>
      ))}
    </div>
  )
}
