import { type MonthTotal } from '../lib/transactions'

function formatUsd(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount)
}

type Props = {
  data: MonthTotal[]
  selectedYearMonth?: string | null
  onSelectYearMonth?: (yearMonth: string) => void
}

export function MonthlySpendChart({ data, selectedYearMonth, onSelectYearMonth }: Props) {
  if (!data.length) return null

  const max = Math.max(...data.map((d) => d.totalUsd))
  const safeMax = max > 0 ? max : 1
  const threshold = 3000

  return (
    <div className="chart">
      <div className="chart__bars">
        {data.map((row) => {
          const pct = Math.max(0, Math.min(100, (row.totalUsd / safeMax) * 100))
          const isSelected = row.yearMonth === selectedYearMonth
          const isHigh = row.totalUsd > threshold
          return (
            <button
              key={row.yearMonth}
              type="button"
              className={`chartRowButton ${isSelected ? 'chartRowButton--selected' : ''} ${isHigh ? 'chartRowButton--high' : ''}`}
              onClick={() => onSelectYearMonth?.(row.yearMonth)}
              aria-pressed={isSelected ? 'true' : 'false'}
            >
              <div className="chartRow">
                <div className="chartRow__label">{row.yearMonth}</div>
                <div className="chartRow__barWrap" aria-hidden="true">
                  <div className={`chartRow__bar ${isHigh ? 'chartRow__bar--high' : ''}`} style={{ width: `${pct}%` }} />
                </div>
                <div className={`chartRow__value ${isHigh ? 'chartRow__value--high' : ''}`}>{formatUsd(row.totalUsd)}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

