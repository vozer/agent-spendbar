import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AnchoredSurface } from '../components/AnchoredSurface'
import { CliErrorPanel } from '../components/CliErrorPanel'
import { EmptyNote } from '../components/EmptyState'
import { RangeCalendar } from '../components/RangeCalendar'
import { SectionSkeleton } from '../components/Skeleton'
import { useEscape } from '../hooks/useEscape'
import { usePolled } from '../hooks/usePolled'
import { formatCompact } from '../lib/format'
import { localeTag } from '../i18n'
import { t } from '../i18n'
import { codeburn } from '../lib/ipc'
import { reportMemoKey } from '../lib/reportMemoKey'
import type { DateRange, PeriodContribution, PeriodDiffReport, PeriodRangeInfo, PeriodSessionDiff } from '../lib/types'
import { Icon } from '../components/icons'

type Lens = 'project' | 'model'
type Persisted = { preset: 'last7' | 'custom'; rangeA: DateRange; rangeB: DateRange; lens: Lens | 'projects' | 'models' }
type Drill = { dimension: Lens; key: string }

const STORAGE_KEY = 'codeburn.periodCompare.v1'

function readPersisted(): Persisted | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<Persisted>
    if (!value.rangeA?.from || !value.rangeB?.from) return null
    return {
      preset: value.preset === 'custom' ? 'custom' : 'last7',
      rangeA: { from: value.rangeA.from, to: value.rangeA.to ?? value.rangeA.from },
      rangeB: { from: value.rangeB.from, to: value.rangeB.to ?? value.rangeB.from },
      lens: value.lens === 'models' || value.lens === 'model' ? 'model' : 'project',
    }
  } catch { return null }
}

function persist(state: Persisted): void {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* storage can be unavailable */ }
}

export function defaultSevenRanges(now = new Date()): { rangeA: DateRange; rangeB: DateRange } {
  const key = (offset: number): string => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  return { rangeB: { from: key(-7), to: key(-1) }, rangeA: { from: key(-14), to: key(-8) } }
}

function formatDate(key: string): string {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(localeTag(), { month: 'short', day: 'numeric', year: 'numeric' })
}

function rangeLabel(range: PeriodRangeInfo): string {
  return range.from === range.to ? formatDate(range.from) : `${formatDate(range.from)} – ${formatDate(range.to)}`
}

function signedCount(value: number): string {
  const count = Math.abs(Math.round(value)).toLocaleString('en-US')
  return value > 0 ? `+${count}` : value < 0 ? `−${count}` : count
}

function signedTokens(value: number): string {
  const count = formatCompact(Math.abs(Math.round(value)))
  return value > 0 ? `+${count}` : value < 0 ? `−${count}` : count
}

function signedPercent(value: number | null): string {
  if (value === null) return '—'
  const body = `${Math.round(Math.abs(value))}%`
  return value > 0 ? `+${body}` : value < 0 ? `−${body}` : '0%'
}

function changePercent(a: number, b: number): number | null {
  return a === 0 ? (b === 0 ? 0 : null) : ((b - a) / Math.abs(a)) * 100
}

export function PeriodCompare({
  provider,
  refreshToken = 0,
  ready = true,
  onInspectContribution,
}: {
  provider: string
  refreshToken?: number
  ready?: boolean
  onInspectContribution?: (range: DateRange, dimension: 'project' | 'model', key: string) => void
}) {
  const saved = useMemo(readPersisted, [])
  const defaults = useMemo(() => defaultSevenRanges(), [])
  const [preset, setPreset] = useState<Persisted['preset']>(saved?.preset ?? 'last7')
  const [rangeA, setRangeA] = useState<DateRange>(saved?.rangeA ?? defaults.rangeA)
  const [rangeB, setRangeB] = useState<DateRange>(saved?.rangeB ?? defaults.rangeB)
  const [lens, setLens] = useState<Lens>(saved?.lens === 'model' ? 'model' : 'project')
  const [drill, setDrill] = useState<Drill | null>(null)

  useEffect(() => { persist({ preset, rangeA, rangeB, lens }) }, [preset, rangeA, rangeB, lens])

  const report = usePolled<PeriodDiffReport>(
    () => codeburn.getPeriodCompare(rangeA, rangeB, provider),
    [rangeA.from, rangeA.to, rangeB.from, rangeB.to, provider, refreshToken],
    { enabled: ready, memoKey: reportMemoKey('periodcompare-usage-v1', 'week', provider, rangeA, `${rangeB.from}..${rangeB.to}`) },
  )

  const swap = useCallback(() => {
    setRangeA(rangeB)
    setRangeB(rangeA)
  }, [rangeA, rangeB])

  const pickPreset = useCallback((value: string) => {
    if (value === 'last7') {
      const next = defaultSevenRanges()
      setPreset('last7')
      setRangeA(next.rangeA)
      setRangeB(next.rangeB)
    } else {
      setPreset('custom')
    }
  }, [])

  return (
    <div className="pcmp" aria-label={t('compare.periodCompare.rootAriaLabel')}>
      <div className="panel cmp-card pcmp-controls">
        <div className="pbody pcmp-controls-body">
          <div className="pcmp-controls-row">
            <div className="seg">
              <button type="button" className={preset === 'last7' ? 'on' : undefined} aria-pressed={preset === 'last7'} onClick={() => pickPreset('last7')}>{t('compare.periodCompare.preset.last7')}</button>
              <button type="button" className={preset === 'custom' ? 'on' : undefined} aria-pressed={preset === 'custom'} onClick={() => pickPreset('custom')}>{t('compare.periodCompare.preset.custom')}</button>
            </div>
            <button type="button" className="pcmp-swap" onClick={swap} aria-label={t('compare.periodCompare.controls.swapAriaLabel')}>
              <Icon name="arrow-left-right" className="pcmp-swap-icon" /> {t('compare.periodCompare.controls.swap')}
            </button>
          </div>
          <div className="pcmp-ranges">
            <RangeField label={t('compare.periodCompare.range.aLabel')} value={rangeA} onChange={value => { setPreset('custom'); setRangeA(value) }} />
            <RangeField label={t('compare.periodCompare.range.bLabel')} value={rangeB} onChange={value => { setPreset('custom'); setRangeB(value) }} />
          </div>
          <RangeMeta rangeA={rangeA} rangeB={rangeB} />
        </div>
      </div>

      {!report.data
        ? report.error
          ? <CliErrorPanel error={report.error} subject={t('compare.periodCompare.subject')} />
          : <SectionSkeleton label={t('compare.periodCompare.comparing')} rows={4} />
        : <>
            <SummaryCard report={report.data} />
            <TotalsCard report={report.data} />
            <ContributionsCard report={report.data} lens={lens} onLens={setLens} onDrill={setDrill} />
            {drill && (
              <DrillPanel
                rangeA={report.data.rangeA}
                rangeB={report.data.rangeB}
                provider={provider}
                refreshToken={refreshToken}
                drill={drill}
                onInspectContribution={onInspectContribution}
                onClose={() => setDrill(null)}
              />
            )}
          </>}
    </div>
  )
}

function RangeField({ label, value, onChange }: { label: string; value: DateRange; onChange: (range: DateRange) => void }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!wrapRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])
  useEscape(open, () => setOpen(false))

  return (
    <div className="pcmp-range" ref={wrapRef}>
      <span className="pcmp-range-label">{label}</span>
      <button ref={triggerRef} type="button" className="pcmp-range-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(current => !current)}>
        {formatDate(value.from)} – {formatDate(value.to)}
      </button>
      {open && (
        <AnchoredSurface anchor={triggerRef} surfaceRef={popoverRef} className="calendar-popover" role="dialog" aria-label={t('compare.periodCompare.range.dateRangeAriaLabel', { label })}>
          <RangeCalendar value={value} onSelect={range => { onChange(range); setOpen(false) }} />
        </AnchoredSurface>
      )}
    </div>
  )
}

function RangeMeta({ rangeA, rangeB }: { rangeA: DateRange; rangeB: DateRange }) {
  const days = (range: DateRange): number => {
    const [fy, fm, fd] = range.from.split('-').map(Number)
    const [ty, tm, td] = range.to.split('-').map(Number)
    const cursor = new Date(fy, fm - 1, fd)
    const end = new Date(ty, tm - 1, td)
    if (cursor > end) return 0
    let count = 0
    while (cursor <= end) { count++; cursor.setDate(cursor.getDate() + 1) }
    return count
  }
  const aDays = days(rangeA)
  const bDays = days(rangeB)
  const overlapStart = rangeA.from > rangeB.from ? rangeA.from : rangeB.from
  const overlapEnd = rangeA.to < rangeB.to ? rangeA.to : rangeB.to
  const overlap = overlapStart <= overlapEnd ? days({ from: overlapStart, to: overlapEnd }) : 0
  const unit = (count: number) => t(count === 1 ? 'compare.periodCompare.meta.day' : 'compare.periodCompare.meta.days')
  return <p className="pcmp-meta" role="status">{t('compare.periodCompare.meta.aSpans', { count: aDays, unit: unit(aDays) })} · {t('compare.periodCompare.meta.bSpans', { count: bDays, unit: unit(bDays) })}{overlap > 0 && <> · {t('compare.periodCompare.meta.overlap', { count: overlap, unit: unit(overlap) })}</>}</p>
}

function SummaryCard({ report }: { report: PeriodDiffReport }) {
  const metrics = [
    { id: 'sessions', label: t('compare.periodCompare.summary.sessions'), a: report.totals.A.sessions, b: report.totals.B.sessions, diff: report.totals.diff.sessions, pct: report.totals.pct.sessions, tokens: false },
    { id: 'calls', label: t('compare.periodCompare.totals.apiCalls'), a: report.totals.A.calls, b: report.totals.B.calls, diff: report.totals.diff.calls, pct: report.totals.pct.calls, tokens: false },
    { id: 'input', label: t('compare.periodCompare.totals.inputTokens'), a: report.totals.A.inputTokens, b: report.totals.B.inputTokens, diff: report.totals.diff.inputTokens, pct: report.totals.pct.inputTokens, tokens: true },
    { id: 'output', label: t('compare.periodCompare.totals.outputTokens'), a: report.totals.A.outputTokens, b: report.totals.B.outputTokens, diff: report.totals.diff.outputTokens, pct: report.totals.pct.outputTokens, tokens: true },
  ]
  return (
    <div className="panel cmp-card pcmp-summary">
      <div className="pbody pcmp-summary-body">
        <p className="pcmp-lead">{t('compare.periodCompare.lead.subjectRange', { range: rangeLabel(report.rangeB) })}: {t('compare.periodCompare.summary.sessions')} {signedCount(report.totals.diff.sessions)}; {t('compare.periodCompare.totals.apiCalls')} {signedCount(report.totals.diff.calls)}.</p>
        <div className="pcmp-tiles">
          {metrics.map(metric => (
            <div className="pcmp-tile" key={metric.id}>
              <span className="pcmp-tile-label">{metric.label}</span>
              <span className="pcmp-tile-value">{metric.tokens ? formatCompact(metric.b) : metric.b.toLocaleString('en-US')}</span>
              <span className="pcmp-tile-change">{metric.tokens ? signedTokens(metric.diff) : signedCount(metric.diff)}, {signedPercent(metric.pct)}</span>
              <small className="pcmp-caption">A {metric.tokens ? formatCompact(metric.a) : metric.a.toLocaleString('en-US')} · B {metric.tokens ? formatCompact(metric.b) : metric.b.toLocaleString('en-US')}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TotalsCard({ report }: { report: PeriodDiffReport }) {
  const rows = [
    { label: t('compare.periodCompare.summary.sessions'), a: report.totals.A.sessions, b: report.totals.B.sessions, diff: report.totals.diff.sessions, pct: report.totals.pct.sessions, compact: false },
    { label: t('compare.periodCompare.totals.apiCalls'), a: report.totals.A.calls, b: report.totals.B.calls, diff: report.totals.diff.calls, pct: report.totals.pct.calls, compact: false },
    { label: t('compare.periodCompare.totals.inputTokens'), a: report.totals.A.inputTokens, b: report.totals.B.inputTokens, diff: report.totals.diff.inputTokens, pct: report.totals.pct.inputTokens, compact: true },
    { label: t('compare.periodCompare.totals.outputTokens'), a: report.totals.A.outputTokens, b: report.totals.B.outputTokens, diff: report.totals.diff.outputTokens, pct: report.totals.pct.outputTokens, compact: true },
    { label: t('compare.periodCompare.totals.cacheReadTokens'), a: report.totals.A.cacheReadTokens, b: report.totals.B.cacheReadTokens, diff: report.totals.diff.cacheReadTokens, pct: report.totals.pct.cacheReadTokens, compact: true },
    { label: t('compare.periodCompare.totals.cacheWriteTokens'), a: report.totals.A.cacheWriteTokens, b: report.totals.B.cacheWriteTokens, diff: report.totals.diff.cacheWriteTokens, pct: report.totals.pct.cacheWriteTokens, compact: true },
  ]
  return (
    <div className="panel cmp-card pcmp-block">
      <div className="cmp-head"><h3>{t('compare.periodCompare.allMetrics')}</h3></div>
      <div className="pbody">
        <div className="pcmp-table" role="table" aria-label={t('compare.periodCompare.totals.tableAriaLabel')}>
          <div className="pcmp-tr pcmp-th" role="row"><span role="columnheader">{t('compare.periodCompare.col.metric')}</span><span role="columnheader">A</span><span role="columnheader">B</span><span role="columnheader">{t('compare.periodCompare.col.diff')}</span><span role="columnheader">{t('compare.periodCompare.col.pct')}</span></div>
          {rows.map(row => (
            <div className="pcmp-tr" role="row" key={row.label}>
              <span role="cell" className="pcmp-label">{row.label}</span>
              <span role="cell">{row.compact ? formatCompact(row.a) : row.a.toLocaleString('en-US')}</span>
              <span role="cell">{row.compact ? formatCompact(row.b) : row.b.toLocaleString('en-US')}</span>
              <span role="cell">{row.compact ? signedTokens(row.diff) : signedCount(row.diff)}</span>
              <span role="cell">{signedPercent(row.pct)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function statusFor(a: number, b: number): PeriodContribution['status'] {
  if (a === 0 && b > 0) return 'new'
  if (a > 0 && b === 0) return 'gone'
  if (b > a) return 'up'
  if (b < a) return 'down'
  return 'flat'
}

function ContributionsCard({ report, lens, onLens, onDrill }: { report: PeriodDiffReport; lens: Lens; onLens: (lens: Lens) => void; onDrill: (drill: Drill) => void }) {
  const rows = (lens === 'project' ? report.projects : report.models)
    .filter(row => row.callsA > 0 || row.callsB > 0)
    .sort((a, b) => Math.max(b.callsA, b.callsB) - Math.max(a.callsA, a.callsB) || a.key.localeCompare(b.key))
    .slice(0, 20)
  return (
    <div className="panel cmp-card pcmp-block">
      <div className="cmp-head">
        <h3>{t('compare.periodCompare.movers.title')}</h3>
        <span className="seg">
          <button type="button" className={lens === 'project' ? 'on' : undefined} aria-pressed={lens === 'project'} onClick={() => onLens('project')}>{t('compare.periodCompare.lens.projects')}</button>
          <button type="button" className={lens === 'model' ? 'on' : undefined} aria-pressed={lens === 'model'} onClick={() => onLens('model')}>{t('compare.periodCompare.lens.models')}</button>
        </span>
      </div>
      <div className="pbody">
        {rows.length === 0 ? <EmptyNote>{t('compare.periodCompare.movers.empty')}</EmptyNote> : (
          <div className="pcmp-table" role="table" aria-label={t('compare.periodCompare.movers.tableAriaLabel')}>
            <div className="pcmp-tr pcmp-th" role="row"><span role="columnheader">{t(lens === 'project' ? 'compare.periodCompare.col.project' : 'compare.periodCompare.col.model')}</span><span role="columnheader">A calls</span><span role="columnheader">B calls</span><span role="columnheader">{t('compare.periodCompare.col.diff')}</span><span role="columnheader">{t('compare.periodCompare.col.pct')}</span></div>
            {rows.map(row => {
              const diff = row.callsB - row.callsA
              const status = statusFor(row.callsA, row.callsB)
              return (
                <button type="button" className="pcmp-tr pcmp-mover-row" role="row" key={row.key} onClick={() => onDrill({ dimension: lens, key: row.key })}>
                  <span role="cell" className="pcmp-label" title={row.key}>{row.key}<small className={`pcmp-badge ${status}`}>{t(`compare.periodCompare.status.${status}`)}</small></span>
                  <span role="cell">{row.callsA.toLocaleString('en-US')}</span>
                  <span role="cell">{row.callsB.toLocaleString('en-US')}</span>
                  <span role="cell">{signedCount(diff)}</span>
                  <span role="cell">{signedPercent(changePercent(row.callsA, row.callsB))}</span>
                </button>
              )
            })}
          </div>
        )}
        <p className="pcmp-caption">{t('compare.periodCompare.movers.footerCaption')}</p>
      </div>
    </div>
  )
}

function DrillPanel({ rangeA, rangeB, provider, refreshToken, drill, onInspectContribution, onClose }: {
  rangeA: PeriodRangeInfo
  rangeB: PeriodRangeInfo
  provider: string
  refreshToken: number
  drill: Drill
  onInspectContribution?: (range: DateRange, dimension: 'project' | 'model', key: string) => void
  onClose: () => void
}) {
  const report = usePolled<PeriodSessionDiff>(
    () => codeburn.getPeriodCompareSessions({ from: rangeA.from, to: rangeA.to }, { from: rangeB.from, to: rangeB.to }, provider, drill.dimension, drill.key),
    [rangeA.from, rangeA.to, rangeB.from, rangeB.to, provider, drill.dimension, drill.key, refreshToken],
    { memoKey: reportMemoKey('periodcomparesessions-usage-v1', 'week', provider, { from: rangeA.from, to: rangeA.to }, JSON.stringify([rangeB.from, rangeB.to, drill.dimension, drill.key])) },
  )
  if (!report.data) {
    if (report.error) return <CliErrorPanel error={report.error} subject={t('compare.periodCompare.drill.subject')} />
    return <SectionSkeleton label={t('compare.periodCompare.drill.loading')} rows={3} />
  }

  return (
    <div className="pcmp-drill" aria-label={t('compare.periodCompare.drill.ariaLabel', { key: drill.key })}>
      <div className="pcmp-drill-head">
        <strong>{t(drill.dimension === 'project' ? 'compare.periodCompare.col.project' : 'compare.periodCompare.col.model')}: {drill.key}</strong>
        <span className="pcmp-drill-actions">
          <button type="button" className="ov-link" onClick={() => onInspectContribution?.({ from: rangeA.from, to: rangeA.to }, drill.dimension, drill.key)}>{t('compare.periodCompare.drill.openAInSessions')}</button>
          <button type="button" className="ov-link" onClick={() => onInspectContribution?.({ from: rangeB.from, to: rangeB.to }, drill.dimension, drill.key)}>{t('compare.periodCompare.drill.openBInSessions')}</button>
          <button type="button" className="ov-link" onClick={onClose}>{t('compare.periodCompare.drill.close')}</button>
        </span>
      </div>
      <div className="pcmp-table" role="table" aria-label={t('compare.periodCompare.drill.tableAriaLabel')}>
        <div className="pcmp-tr pcmp-th" role="row"><span role="columnheader">{t('compare.periodCompare.col.session')}</span><span role="columnheader">{t('compare.periodCompare.col.provider')}</span><span role="columnheader">A calls</span><span role="columnheader">B calls</span><span role="columnheader">{t('compare.periodCompare.col.diff')}</span></div>
        {report.data.sessions.length === 0 && <div className="pcmp-tr" role="row"><span role="cell"><EmptyNote>{t('compare.periodCompare.drill.noSessions')}</EmptyNote></span></div>}
        {report.data.sessions.map(session => (
          <div className="pcmp-tr" role="row" key={session.identity}>
            <span role="cell" className="pcmp-label" title={session.project}>{session.title ?? session.sessionId}<small className="pcmp-sub">{session.project}</small></span>
            <span role="cell">{session.provider}</span>
            <span role="cell">{session.callsA.toLocaleString('en-US')}</span>
            <span role="cell">{session.callsB.toLocaleString('en-US')}</span>
            <span role="cell">{signedCount(session.callsB - session.callsA)}</span>
          </div>
        ))}
      </div>
      <p className="pcmp-caption">{t('compare.periodCompare.drill.caption')}</p>
    </div>
  )
}
