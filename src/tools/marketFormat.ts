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
