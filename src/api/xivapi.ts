export type XivapiSheet = 'Item' | 'Recipe' | 'Quest' | 'Action'
type XivapiLanguage = 'en' | 'chs'

interface XivapiRawResult {
  sheet?: string
  row_id?: number
  score?: number
  fields?: Record<string, unknown>
}

interface XivapiSearchResponse {
  results?: XivapiRawResult[]
}

interface XivapiSheetResponse {
  row_id?: number
  fields?: Record<string, unknown>
}

export interface XivapiSearchResult {
  sheet: string
  rowId: number
  name: string
  score: number
}

export interface XivapiRecipeSearchResult extends XivapiSearchResult {
  craftTypeName?: string
  itemRowId?: number
}

export interface XivapiRecipeDetail {
  rowId: number
  name: string
  craftTypeName: string
  classJobLevel: number
  difficulty: number
  durability: number
  quality: number
  progressDivider: number
  progressModifier: number
  qualityDivider: number
  qualityModifier: number
  canHq: boolean
  amountResult: number
  ingredients: Array<{ name: string; amount: number }>
}

export interface XivapiItemSummary {
  rowId: number
  name: string
}

export interface XivapiEquipmentSearchResult {
  rowId: number
  name: string
  itemLevel: number
  levelEquip: number
  itemUiCategoryId: number
  itemUiCategoryName: string
  classJobCategoryName?: string
  isUntradable: boolean
}

const XIVAPI_SEARCH_URL = 'https://v2.xivapi.com/api/search'
const XIVAPI_SHEET_URL = 'https://v2.xivapi.com/api/sheet'

function sanitizeTerm(term: string): string {
  return term.replace(/"/g, '\\"').trim()
}

function clampLimit(limit: number, maximum = 20): number {
  return Math.max(1, Math.min(maximum, Math.round(limit)))
}

function getNestedString(value: unknown, path: string[]): string | null {
  let current = value

  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return null
    }
    current = (current as Record<string, unknown>)[key]
  }

  return typeof current === 'string' && current.trim() ? current.trim() : null
}

function getNestedNumber(value: unknown, path: string[]): number | null {
  let current = value

  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return null
    }
    current = (current as Record<string, unknown>)[key]
  }

  return typeof current === 'number' ? current : null
}

function getNestedBoolean(value: unknown, path: string[]): boolean | null {
  let current = value

  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return null
    }
    current = (current as Record<string, unknown>)[key]
  }

  return typeof current === 'boolean' ? current : null
}

function buildSearchParams(
  sheet: XivapiSheet,
  field: string,
  query: string,
  limit: number,
  language: XivapiLanguage = 'en',
  maximumLimit = 20,
): URLSearchParams {
  return new URLSearchParams({
    sheets: sheet,
    fields: field,
    query,
    limit: clampLimit(limit, maximumLimit).toString(),
    language,
  })
}

export function buildXivapiSearchUrl(term: string, sheet: XivapiSheet, limit = 8, field = 'Name'): string {
  const params = buildSearchParams(sheet, field, `${field}~"${sanitizeTerm(term)}"`, limit)
  return `${XIVAPI_SEARCH_URL}?${params.toString()}`
}

export function buildXivapiRecipeSearchUrl(term: string, limit = 8): string {
  const field = 'ItemResult.Name,CraftType.Name'
  const params = buildSearchParams('Recipe', field, `ItemResult.Name~"${sanitizeTerm(term)}"`, limit)
  return `${XIVAPI_SEARCH_URL}?${params.toString()}`
}

export function buildXivapiEquipmentSearchUrl(
  itemLevel: number,
  options?: { categoryQuery?: string; limit?: number; language?: XivapiLanguage },
): string {
  const fields = [
    'Name',
    'LevelItem',
    'LevelEquip',
    'ItemUICategory.Name',
    'ClassJobCategory.Name',
    'IsUntradable',
  ]
  const safeItemLevel = Math.max(1, Math.min(999, Math.round(itemLevel)))
  const queryParts = [`LevelItem=${safeItemLevel}`, 'LevelEquip>=1']
  const trimmedCategoryQuery = options?.categoryQuery?.trim()
  if (trimmedCategoryQuery) {
    queryParts.push(trimmedCategoryQuery)
  }

  const params = buildSearchParams(
    'Item',
    fields.join(','),
    queryParts.join(' '),
    options?.limit ?? 100,
    options?.language ?? 'en',
    100,
  )

  return `${XIVAPI_SEARCH_URL}?${params.toString()}`
}

export function buildXivapiSheetRowUrl(
  sheet: XivapiSheet,
  rowId: number,
  fields: string[],
  language: 'en' | 'chs' = 'en',
): string {
  const params = new URLSearchParams({
    language,
    fields: fields.join(','),
  })

  return `${XIVAPI_SHEET_URL}/${sheet}/${Math.max(0, Math.round(rowId))}?${params.toString()}`
}

async function fetchSheetRow(
  sheet: XivapiSheet,
  rowId: number,
  fields: string[],
  language: 'en' | 'chs' = 'en',
): Promise<XivapiSheetResponse> {
  const response = await fetch(buildXivapiSheetRowUrl(sheet, rowId, fields, language))
  if (!response.ok) {
    throw new Error(`XIVAPI ${sheet} detail request failed with HTTP ${response.status}.`)
  }

  return (await response.json()) as XivapiSheetResponse
}

export async function searchXivapi(term: string, sheet: XivapiSheet, limit = 8, language: XivapiLanguage = 'en'): Promise<XivapiSearchResult[]> {
  const trimmedTerm = term.trim()
  if (trimmedTerm.length < 2) {
    return []
  }

  const params = buildSearchParams(sheet, 'Name', `Name~"${sanitizeTerm(trimmedTerm)}"`, limit, language)
  const response = await fetch(`${XIVAPI_SEARCH_URL}?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`XIVAPI request failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as XivapiSearchResponse

  return (payload.results ?? [])
    .filter((result): result is Required<Pick<XivapiRawResult, 'sheet' | 'row_id'>> & XivapiRawResult => {
      return typeof result.sheet === 'string' && typeof result.row_id === 'number'
    })
    .map((result) => ({
      sheet: result.sheet,
      rowId: result.row_id,
      name: getNestedString(result.fields, ['Name']) ?? '(Unnamed Row)',
      score: typeof result.score === 'number' ? result.score : 0,
    }))
}

export async function searchEquipmentByItemLevel(
  itemLevel: number,
  options?: { categoryQuery?: string; limit?: number; language?: XivapiLanguage },
): Promise<XivapiEquipmentSearchResult[]> {
  const response = await fetch(buildXivapiEquipmentSearchUrl(itemLevel, options))
  if (!response.ok) {
    throw new Error(`XIVAPI equipment search failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as XivapiSearchResponse
  const safeItemLevel = Math.max(1, Math.min(999, Math.round(itemLevel)))

  return (payload.results ?? [])
    .filter((result): result is Required<Pick<XivapiRawResult, 'sheet' | 'row_id'>> & XivapiRawResult => {
      return typeof result.sheet === 'string' && typeof result.row_id === 'number'
    })
    .map((result) => ({
      rowId: result.row_id,
      name: getNestedString(result.fields, ['Name']) ?? '(Unnamed Item)',
      itemLevel: getNestedNumber(result.fields, ['LevelItem', 'value']) ?? safeItemLevel,
      levelEquip: getNestedNumber(result.fields, ['LevelEquip']) ?? 0,
      itemUiCategoryId: getNestedNumber(result.fields, ['ItemUICategory', 'row_id']) ?? 0,
      itemUiCategoryName: getNestedString(result.fields, ['ItemUICategory', 'fields', 'Name']) ?? 'Unknown Category',
      classJobCategoryName: getNestedString(result.fields, ['ClassJobCategory', 'fields', 'Name']) ?? undefined,
      isUntradable: getNestedBoolean(result.fields, ['IsUntradable']) ?? false,
    }))
}

export async function searchRecipeResults(term: string, limit = 8): Promise<XivapiRecipeSearchResult[]> {
  const trimmedTerm = term.trim()
  if (trimmedTerm.length < 2) {
    return []
  }

  const response = await fetch(buildXivapiRecipeSearchUrl(trimmedTerm, limit))
  if (!response.ok) {
    throw new Error(`XIVAPI recipe search failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as XivapiSearchResponse

  return (payload.results ?? [])
    .filter((result): result is Required<Pick<XivapiRawResult, 'sheet' | 'row_id'>> & XivapiRawResult => {
      return typeof result.sheet === 'string' && typeof result.row_id === 'number'
    })
    .map((result) => ({
      sheet: result.sheet,
      rowId: result.row_id,
      name: getNestedString(result.fields, ['ItemResult', 'fields', 'Name']) ?? '(Unnamed Recipe)',
      craftTypeName: getNestedString(result.fields, ['CraftType', 'fields', 'Name']) ?? undefined,
      itemRowId: getNestedNumber(result.fields, ['ItemResult', 'row_id']) ?? undefined,
      score: typeof result.score === 'number' ? result.score : 0,
    }))
}

export async function fetchRecipeDetails(rowId: number): Promise<XivapiRecipeDetail> {
  const fields = [
    'CraftType.Name',
    'ItemResult.Name',
    'RecipeLevelTable.ClassJobLevel',
    'RecipeLevelTable.Difficulty',
    'RecipeLevelTable.Durability',
    'RecipeLevelTable.Quality',
    'RecipeLevelTable.ProgressDivider',
    'RecipeLevelTable.ProgressModifier',
    'RecipeLevelTable.QualityDivider',
    'RecipeLevelTable.QualityModifier',
    'Ingredient[].Name',
    'AmountIngredient',
    'AmountResult',
    'CanHq',
  ]

  const payload = await fetchSheetRow('Recipe', rowId, fields)
  const rawFields = payload.fields ?? {}
  const ingredientRows = Array.isArray(rawFields.Ingredient) ? rawFields.Ingredient : []
  const amountRows = Array.isArray(rawFields.AmountIngredient) ? rawFields.AmountIngredient : []

  return {
    rowId: typeof payload.row_id === 'number' ? payload.row_id : rowId,
    name: getNestedString(rawFields, ['ItemResult', 'fields', 'Name']) ?? '未命名配方',
    craftTypeName: getNestedString(rawFields, ['CraftType', 'fields', 'Name']) ?? 'Unknown',
    classJobLevel: getNestedNumber(rawFields, ['RecipeLevelTable', 'fields', 'ClassJobLevel']) ?? 0,
    difficulty: getNestedNumber(rawFields, ['RecipeLevelTable', 'fields', 'Difficulty']) ?? 0,
    durability: getNestedNumber(rawFields, ['RecipeLevelTable', 'fields', 'Durability']) ?? 0,
    quality: getNestedNumber(rawFields, ['RecipeLevelTable', 'fields', 'Quality']) ?? 0,
    progressDivider: getNestedNumber(rawFields, ['RecipeLevelTable', 'fields', 'ProgressDivider']) ?? 100,
    progressModifier: getNestedNumber(rawFields, ['RecipeLevelTable', 'fields', 'ProgressModifier']) ?? 100,
    qualityDivider: getNestedNumber(rawFields, ['RecipeLevelTable', 'fields', 'QualityDivider']) ?? 100,
    qualityModifier: getNestedNumber(rawFields, ['RecipeLevelTable', 'fields', 'QualityModifier']) ?? 100,
    canHq: getNestedBoolean(rawFields, ['CanHq']) ?? true,
    amountResult: getNestedNumber(rawFields, ['AmountResult']) ?? 1,
    ingredients: ingredientRows
      .map((ingredient, index) => ({
        name: getNestedString(ingredient, ['fields', 'Name']) ?? 'Unknown Ingredient',
        amount: typeof amountRows[index] === 'number' ? amountRows[index] : 0,
      }))
      .filter((ingredient) => ingredient.amount > 0),
  }
}

export async function fetchItemSummary(rowId: number): Promise<XivapiItemSummary> {
  for (const language of ['chs', 'en'] as const) {
    try {
      const payload = await fetchSheetRow('Item', rowId, ['Name'], language)
      const name = getNestedString(payload.fields, ['Name'])
      if (name) {
        return {
          rowId: typeof payload.row_id === 'number' ? payload.row_id : rowId,
          name,
        }
      }
    } catch {
      // Fall back to the next language.
    }
  }

  throw new Error(`XIVAPI item detail lookup failed for row ${rowId}.`)
}
