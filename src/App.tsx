import './App.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileDropzone } from './components/FileDropzone'
import { MonthlySpendChart } from './components/MonthlySpendChart'
import { MonthBreakdown } from './components/MonthBreakdown'
import { computeMonthlySpendFromCsvText, type ParseResult } from './lib/transactions'

function App() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedYearMonth, setSelectedYearMonth] = useState<string | null>(null)

  const onFileText = useCallback((name: string, text: string) => {
    setError(null)
    setFileName(name)
    setSelectedYearMonth(null)
    try {
      const r = computeMonthlySpendFromCsvText(text)
      setResult(r)
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : 'Failed to parse CSV')
    }
  }, [])

  const monthTotalsForChart = useMemo(() => {
    // Most recent first
    return [...(result?.monthTotals ?? [])].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))
  }, [result])

  const dateRange = useMemo(() => {
    const earliest = result?.summary.earliest
    const latest = result?.summary.latest
    if (!earliest || !latest) return null
    return { earliest, latest }
  }, [result])

  useEffect(() => {
    if (!selectedYearMonth) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedYearMonth(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedYearMonth])

  return (
    <div className="app">
      <header className="appHeader">
        <h1 className="appTitle">Monthly Spend</h1>
        <p className="appSubtitle">
          Upload your transactions CSV to see how much you’ve spent each month. No data leaves your browser.
        </p>
      </header>

      {error && (
        <section className="panel panel--error" role="alert">
          <div className="panel__title">Couldn’t read that CSV</div>
          <div className="panel__body">{error}</div>
        </section>
      )}

      {result && (
        <>
          <section className="panel">
            <div className="summaryLine">
              <span>
                <span className="summaryLine__label">Included</span>{' '}
                <span className="summaryLine__value">{result.summary.includedRows}</span>
              </span>
              <span className="summaryLine__sep">•</span>
              <span>
                <span className="summaryLine__label">Ignored</span>{' '}
                <span className="summaryLine__value">{result.summary.ignoredRows}</span>
              </span>
              <span className="summaryLine__sep">•</span>
              <span>
                <span className="summaryLine__label">Months</span>{' '}
                <span className="summaryLine__value">{result.monthTotals.length}</span>
              </span>
              {dateRange && (
                <>
                  <span className="summaryLine__sep">•</span>
                  <span className="mono">
                    <span className="summaryLine__label">Range</span>{' '}
                    <span className="summaryLine__value">
                      {dateRange.earliest.toISOString().slice(0, 10)} → {dateRange.latest.toISOString().slice(0, 10)}
                    </span>
                  </span>
                </>
              )}
            </div>

            {result.summary.warnings.length > 0 && (
              <details className="warnings">
                <summary className="warnings__summary">
                  Warnings ({result.summary.warnings.length})
                </summary>
                <ul className="warnings__list">
                  {result.summary.warnings.slice(0, 50).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {result.summary.warnings.length > 50 && (
                    <li>…and {result.summary.warnings.length - 50} more</li>
                  )}
                </ul>
              </details>
            )}
          </section>

          <MonthlySpendChart
            data={monthTotalsForChart}
            selectedYearMonth={selectedYearMonth}
            onSelectYearMonth={(ym) => setSelectedYearMonth(ym)}
          />
        </>
      )}

      {result && selectedYearMonth && (
        <div
          className="modalOverlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) setSelectedYearMonth(null)
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-label={`Breakdown for ${selectedYearMonth}`}>
            <MonthBreakdown
              yearMonth={selectedYearMonth}
              transactions={result.transactions}
              onClear={() => setSelectedYearMonth(null)}
            />
          </div>
        </div>
      )}

      <section className="panel">
        <FileDropzone onFileText={onFileText} />
        {fileName && (
          <div className="meta">
            Loaded: <span className="mono">{fileName}</span>
          </div>
        )}
      </section>
    </div>
  )
}

export default App
