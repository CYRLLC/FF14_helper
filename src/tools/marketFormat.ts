export function formatGil(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '無資料'
  }

  return `${new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: 0,
  }).format(value)} gil`
}

export function formatShortDateTime(value: string | number | undefined): string {
  if (typeof value === 'undefined') {
    return '無資料'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '無資料'
  }

  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function formatRelativeTime(value: string | number | undefined): string {
  if (typeof value === 'undefined') {
    return '無資料'
  }

  let timestamp: number
  if (typeof value === 'number') {
    timestamp = value < 1_000_000_000_000 ? value * 1000 : value
  } else {
    timestamp = new Date(value).getTime()
  }

  if (Number.isNaN(timestamp)) {
    return '無資料'
  }

  const deltaMs = timestamp - Date.now()
  const absMs = Math.abs(deltaMs)
  const rtf = new Intl.RelativeTimeFormat('zh-TW', { numeric: 'auto' })

  if (absMs < 60_000) return rtf.format(Math.round(deltaMs / 1000), 'second')
  if (absMs < 3_600_000) return rtf.format(Math.round(deltaMs / 60_000), 'minute')
  if (absMs < 86_400_000) return rtf.format(Math.round(deltaMs / 3_600_000), 'hour')
  return rtf.format(Math.round(deltaMs / 86_400_000), 'day')
}
