import { useEffect, useMemo, useRef, useState } from 'react'
import { type NormalizedTransaction } from '../lib/transactions'

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

type Props = {
  yearMonth: string
  transactions: NormalizedTransaction[]
  onClear: () => void
}

export function MonthBreakdown({ yearMonth, transactions, onClear }: Props) {
  const txs = useMemo(() => {
    return transactions
      .filter((t) => t.yearMonth === yearMonth)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [transactions, yearMonth])

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
  }, [yearMonth, txs.length])

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
                  <div className="merchantRow__name">{m.merchantName}</div>
                  <div className="merchantRow__meta">
                    <span className="merchantRow__amount">{formatUsd(m.totalUsd)}</span>
                    <span className="merchantRow__count">{m.count}×</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="breakdownCard">
          <div className="breakdownCard__title">Transactions (newest first)</div>
          {txs.length === 0 ? (
            <div className="breakdownCard__empty">No rows for this month.</div>
          ) : (
            <div className={`txListWrap ${showTxFade ? 'txListWrap--fade' : ''}`} aria-hidden="false">
              <div className="txList" role="list" ref={txListRef}>
                {txs.slice(0, 200).map((t, idx) => (
                  <div className="txRow" role="listitem" key={`${t.yearMonth}-${t.date.toISOString()}-${idx}`}>
                    <div className="txRow__left">
                      <div className="txRow__merchant">{t.merchantName}</div>
                      <div className="txRow__meta mono">{formatDateUtc(t.date)} • {t.type}</div>
                    </div>
                    <div className="txRow__amount">{formatUsd(t.amountUsd)}</div>
                  </div>
                ))}
                {txs.length > 200 && <div className="txRow txRow--more">Showing first 200 of {txs.length}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

