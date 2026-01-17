import { useEffect, useMemo, useRef, useState } from 'react'
import { type NormalizedTransaction } from '../lib/transactions'

type TxSortMode =
  | 'time_desc'
  | 'time_asc'
  | 'merchant_asc'
  | 'merchant_desc'
  | 'amount_desc'
  | 'amount_asc'

function sortModeLabel(mode: TxSortMode): string {
  switch (mode) {
    case 'time_desc':
      return 'Time (newest first)'
    case 'time_asc':
      return 'Time (oldest first)'
    case 'merchant_asc':
      return 'Merchant (A → Z)'
    case 'merchant_desc':
      return 'Merchant (Z → A)'
    case 'amount_desc':
      return 'Amount (high → low)'
    case 'amount_asc':
      return 'Amount (low → high)'
  }
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDateUtc(d: Date): string {
  // Keep it consistent with the UTC month bucketing
  return d.toISOString().slice(0, 10)
}

function formatDateMaybeTimeUtc(d: Date, hasTime?: boolean): string {
  const date = formatDateUtc(d)
  if (!hasTime) return date
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${date} ${hh}:${mm}`
}

type Props = {
  yearMonth: string
  transactions: NormalizedTransaction[]
  onClear: () => void
}

export function MonthBreakdown({ yearMonth, transactions, onClear }: Props) {
  const [txSortMode, setTxSortMode] = useState<TxSortMode>('time_desc')
  const [merchantFilter, setMerchantFilter] = useState('')
  const merchantFilterInputRef = useRef<HTMLInputElement | null>(null)

  const txs = useMemo(() => transactions.filter((t) => t.yearMonth === yearMonth), [transactions, yearMonth])

  const txsForDisplay = useMemo(() => {
    const q = merchantFilter.trim().toLocaleLowerCase()
    const filtered = q ? txs.filter((t) => t.merchantName.toLocaleLowerCase().includes(q)) : txs

    const withIdx = filtered.map((t, idx) => ({ t, idx }))
    const cmp = (a: { t: NormalizedTransaction; idx: number }, b: { t: NormalizedTransaction; idx: number }) => {
      const at = a.t
      const bt = b.t

      const timeA = at.date.getTime()
      const timeB = bt.date.getTime()

      const merchantA = at.merchantName.trim().toLocaleLowerCase()
      const merchantB = bt.merchantName.trim().toLocaleLowerCase()

      const amountA = at.amountUsd
      const amountB = bt.amountUsd

      let primary = 0
      switch (txSortMode) {
        case 'time_desc':
          primary = timeB - timeA
          break
        case 'time_asc':
          primary = timeA - timeB
          break
        case 'merchant_asc':
          primary = merchantA.localeCompare(merchantB)
          break
        case 'merchant_desc':
          primary = merchantB.localeCompare(merchantA)
          break
        case 'amount_desc':
          primary = amountB - amountA
          break
        case 'amount_asc':
          primary = amountA - amountB
          break
      }
      if (primary !== 0) return primary

      // Tie-breakers for deterministic order:
      // - Always break ties by time (newest first)
      // - Then by original index (stable)
      const timeTie = timeB - timeA
      if (timeTie !== 0) return timeTie
      return a.idx - b.idx
    }

    return withIdx.sort(cmp).map(({ t }) => t)
  }, [txs, txSortMode, merchantFilter])

  const txListRef = useRef<HTMLDivElement | null>(null)
  const [showTxFade, setShowTxFade] = useState(false)

  useEffect(() => {
    const el = txListRef.current
    if (!el) return

    const compute = () => {
      // Show fade only when there is more content below the fold.
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
      setShowTxFade(remaining > 2)
    }

    compute()
    el.addEventListener('scroll', compute, { passive: true })
    window.addEventListener('resize', compute)
    return () => {
      el.removeEventListener('scroll', compute)
      window.removeEventListener('resize', compute)
    }
  }, [yearMonth, txsForDisplay.length, txSortMode])

  const total = txs.reduce((sum, t) => sum + t.amountUsd, 0)
  const isHigh = total > 3000

  const byMerchant = new Map<string, { merchantName: string; totalUsd: number; count: number }>()
  for (const t of txs) {
    const key = t.merchantName
    const prev = byMerchant.get(key) ?? { merchantName: key, totalUsd: 0, count: 0 }
    byMerchant.set(key, { merchantName: key, totalUsd: prev.totalUsd + t.amountUsd, count: prev.count + 1 })
  }

  const topMerchants = Array.from(byMerchant.values())
    .sort((a, b) => b.totalUsd - a.totalUsd)
    .slice(0, 10)

  return (
    <section className="breakdown" aria-label={`Breakdown for ${yearMonth}`}>
      <div className="breakdown__header">
        <div>
          <div className="breakdown__title">{yearMonth} breakdown</div>
          <div className="breakdown__subtitle">
            {txs.length} transactions • Total{' '}
            <span className={isHigh ? 'money--high' : undefined}>{formatUsd(total)}</span>
          </div>
        </div>
        <button type="button" className="breakdown__close" onClick={onClear}>
          Close
        </button>
      </div>

      <div className="breakdownGrid">
        <div className="breakdownCard">
          <div className="breakdownCard__title">Top merchants</div>
          {topMerchants.length === 0 ? (
            <div className="breakdownCard__empty">No rows for this month.</div>
          ) : (
            <ul className="merchantList">
              {topMerchants.map((m) => (
                <li key={m.merchantName} className="merchantRow">
                  <button
                    type="button"
                    className="merchantRowButton"
                    onClick={() => {
                      setMerchantFilter(m.merchantName)
                      requestAnimationFrame(() => merchantFilterInputRef.current?.focus())
                    }}
                  >
                    <div className="merchantRow__name">{m.merchantName}</div>
                    <div className="merchantRow__meta">
                      <span className="merchantRow__amount">{formatUsd(m.totalUsd)}</span>
                      <span className="merchantRow__count">{m.count}×</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="breakdownCard">
          <div className="txHeaderRow txHeaderRow--top">
            <div className="breakdownCard__title txHeader__title">Transactions</div>
            <label className="txControl">
              <select
                className="txControl__select"
                value={txSortMode}
                onChange={(e) => setTxSortMode(e.target.value as TxSortMode)}
              >
                <option value="time_desc">{sortModeLabel('time_desc')}</option>
                <option value="time_asc">{sortModeLabel('time_asc')}</option>
                <option value="merchant_asc">{sortModeLabel('merchant_asc')}</option>
                <option value="merchant_desc">{sortModeLabel('merchant_desc')}</option>
                <option value="amount_desc">{sortModeLabel('amount_desc')}</option>
                <option value="amount_asc">{sortModeLabel('amount_asc')}</option>
              </select>
            </label>
          </div>

          <div className="txHeaderRow txHeaderRow--bottom">
            <label className="txControl">
              <input
                className="txControl__input"
                ref={merchantFilterInputRef}
                value={merchantFilter}
                onChange={(e) => setMerchantFilter(e.target.value)}
                placeholder="Filter…"
              />
            </label>
            <div className="breakdownCard__subtle txHeader__count">
              {txsForDisplay.length} / {txs.length}
            </div>
          </div>
          {txs.length === 0 ? (
            <div className="breakdownCard__empty">No rows for this month.</div>
          ) : (
            <div className={`txListWrap ${showTxFade ? 'txListWrap--fade' : ''}`} aria-hidden="false">
              <div className="txList" role="list" ref={txListRef}>
                {txsForDisplay.slice(0, 200).map((t, idx) => (
                  <div className="txRow" role="listitem" key={`${t.yearMonth}-${t.date.toISOString()}-${idx}`}>
                    <div className="txRow__left">
                      <div className="txRow__merchant">{t.merchantName}</div>
                      <div className="txRow__meta mono">{formatDateMaybeTimeUtc(t.date, t.hasTime)}</div>
                    </div>
                    <div className="txRow__amount">{formatUsd(t.amountUsd)}</div>
                  </div>
                ))}
                {txsForDisplay.length > 200 && (
                  <div className="txRow txRow--more">Showing first 200 of {txsForDisplay.length}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

