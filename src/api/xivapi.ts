export type XivapiSheet = 'Item' | 'Recipe' | 'Quest' | 'Action'

interface XivapiRawResult {
  sheet?: string
  row_id?: number
  score?: number
  fields?: {
    Name?: string
  }
}

interface XivapiSearchResponse {
  results?: XivapiRawResult[]
}

export interface XivapiSearchResult {
  sheet: string
  rowId: number
  name: string
  score: number
}

const XIVAPI_BASE_URL = 'https://v2.xivapi.com/api/search'

function sanitizeTerm(term: string): string {
  return term.replace(/"/g, '\\"').trim()
}

export function buildXivapiSearchUrl(
  term: string,
  sheet: XivapiSheet,
  limit = 8,
): string {
  const params = new URLSearchParams({
    sheets: sheet,
    fields: 'Name',
    query: `Name~"${sanitizeTerm(term)}"`,
    limit: Math.max(1, Math.min(20, Math.round(limit))).toString(),
    language: 'en',
  })

  return `${XIVAPI_BASE_URL}?${params.toString()}`
}

export async function searchXivapi(
  term: string,
  sheet: XivapiSheet,
  limit = 8,
): Promise<XivapiSearchResult[]> {
  const trimmedTerm = term.trim()

  if (trimmedTerm.length < 2) {
    return []
  }

  const response = await fetch(buildXivapiSearchUrl(trimmedTerm, sheet, limit))

  if (!response.ok) {
    throw new Error(`XIVAPI request failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as XivapiSearchResponse

  return (payload.results ?? [])
    .filter(
      (result): result is Required<Pick<XivapiRawResult, 'sheet' | 'row_id'>> &
        XivapiRawResult => typeof result.sheet === 'string' && typeof result.row_id === 'number',
    )
    .map((result) => ({
      sheet: result.sheet,
      rowId: result.row_id,
      name: result.fields?.Name?.trim() || '(Unnamed Row)',
      score: typeof result.score === 'number' ? result.score : 0,
    }))
}
