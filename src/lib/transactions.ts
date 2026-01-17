import Papa from 'papaparse'

export type CsvRow = {
  originalCurrency?: string
  originalAmount?: string
  USDAmount?: string
  date?: string
  mcc?: string
  accountAmount?: string
  accountCurrency?: string
  merchantName?: string
  merchantCountry?: string
  status?: string
  declineReason?: string
  authCode?: string
  type?: string
  externalTxId?: string
  externalRootTxId?: string
  apiTransaction?: string
  last4?: string
  // allow extra columns without failing
  [key: string]: string | undefined
}

export type NormalizedTransaction = {
  date: Date
  yearMonth: string // YYYY-MM, UTC-based
  status: string
  type: string
  merchantName: string
  amountUsd: number // positive = spend, negative = refund
  hasTime?: boolean
}

export type ParseSummary = {
  totalRows: number
  includedRows: number
  ignoredRows: number
  earliest?: Date
  latest?: Date
  warnings: string[]
}

export type MonthTotal = {
  yearMonth: string
  totalUsd: number
}

export type ParseResult = {
  summary: ParseSummary
  monthTotals: MonthTotal[]
  transactions: NormalizedTransaction[]
}

function parseNumber(value: unknown): number | undefined {
  if (value == null) return undefined
  const s = String(value).trim()
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

function yearMonthUtc(d: Date): string {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

function updateDateRange(
  range: { earliest?: Date; latest?: Date },
  d: Date,
): { earliest?: Date; latest?: Date } {
  if (!range.earliest || d < range.earliest) range.earliest = d
  if (!range.latest || d > range.latest) range.latest = d
  return range
}

function normalizeRow(row: CsvRow): NormalizedTransaction | { warning: string } {
  const dateStr = row.date?.trim()
  if (!dateStr) return { warning: 'Row missing date' }
  const d = new Date(dateStr)
  if (!Number.isFinite(d.getTime())) return { warning: `Invalid date: ${dateStr}` }
  const hasTime = /:\d{2}/.test(dateStr)

  const status = (row.status ?? '').trim()
  const type = (row.type ?? '').trim()
  const merchantName = (row.merchantName ?? '').trim() || '(unknown merchant)'

  // Prefer accountAmount (normalized) when present; otherwise fall back to USDAmount.
  const accountAmount = parseNumber(row.accountAmount)
  const usdAmount = parseNumber(row.USDAmount)

  const raw = accountAmount ?? usdAmount
  if (raw == null) return { warning: `Row missing amount fields for ${dateStr}` }

  // Purchases tend to be negative in accountAmount; refunds tend to be positive.
  // Normalize to: spend positive; refund negative.
  const abs = Math.abs(raw)
  const amountUsd =
    type === 'REFUND' ? -abs : type === 'POS_TX' ? abs : abs // default abs (will be filtered later)

  return {
    date: d,
    yearMonth: yearMonthUtc(d),
    status,
    type,
    merchantName,
    amountUsd,
    hasTime,
  }
}

export function computeMonthlySpendFromCsvText(csvText: string): ParseResult {
  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    // don't infer types globally; we parse numbers explicitly
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  })

  const warnings: string[] = []
  if (parsed.errors?.length) {
    for (const e of parsed.errors.slice(0, 10)) {
      warnings.push(`${e.code}: ${e.message}${e.row != null ? ` (row ${e.row})` : ''}`)
    }
    if (parsed.errors.length > 10) warnings.push(`...and ${parsed.errors.length - 10} more parse errors`)
  }

  const rows = parsed.data ?? []
  let includedRows = 0
  const transactions: NormalizedTransaction[] = []
  let range: { earliest?: Date; latest?: Date } = {}

  for (const row of rows) {
    // Ignore completely empty objects that some parsers can emit.
    if (!row || Object.keys(row).length === 0) continue

    const normalized = normalizeRow(row)
    if ('warning' in normalized) {
      warnings.push(normalized.warning)
      continue
    }

    // User-selected rules:
    // - Only APPROVED
    // - Only POS_TX purchases
    // - Subtract refunds if present (REFUND)
    const isApproved = normalized.status === 'APPROVED'
    const isPurchase = normalized.type === 'POS_TX'
    const isRefund = normalized.type === 'REFUND'

    if (isApproved && (isPurchase || isRefund)) {
      // We only include refunds if they look like refunds and will subtract.
      if (isPurchase) {
        includedRows += 1
        transactions.push(normalized)
        range = updateDateRange(range, normalized.date)
      } else if (isRefund) {
        includedRows += 1
        transactions.push(normalized)
        range = updateDateRange(range, normalized.date)
      }
    }
  }

  const totalsByMonth = new Map<string, number>()
  for (const tx of transactions) {
    totalsByMonth.set(tx.yearMonth, (totalsByMonth.get(tx.yearMonth) ?? 0) + tx.amountUsd)
  }

  const monthTotals: MonthTotal[] = Array.from(totalsByMonth.entries())
    .map(([yearMonth, totalUsd]) => ({ yearMonth, totalUsd }))
    .sort((a, b) => (a.yearMonth < b.yearMonth ? -1 : a.yearMonth > b.yearMonth ? 1 : 0))

  const totalRows = rows.length
  const ignoredRows = totalRows - includedRows

  return {
    summary: {
      totalRows,
      includedRows,
      ignoredRows,
      earliest: range.earliest,
      latest: range.latest,
      warnings,
    },
    monthTotals,
    transactions,
  }
}

