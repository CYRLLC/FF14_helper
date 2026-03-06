import { describe, expect, it } from 'vitest'
import {
  buildXivapiRecipeSearchUrl,
  buildXivapiSearchUrl,
  buildXivapiSheetRowUrl,
} from './xivapi'

describe('xivapi urls', () => {
  it('builds a search URL for generic sheets', () => {
    const url = buildXivapiSearchUrl('rainbow drip', 'Action', 10)

    expect(url).toContain('https://v2.xivapi.com/api/search?')
    expect(url).toContain('sheets=Action')
    expect(url).toContain('fields=Name')
    expect(url).toContain('limit=10')
    expect(url).toContain('language=en')
    expect(url).toContain('query=Name%7E%22rainbow+drip%22')
  })

  it('builds a recipe search URL using ItemResult.Name', () => {
    const url = buildXivapiRecipeSearchUrl('tacos', 6)

    expect(url).toContain('sheets=Recipe')
    expect(url).toContain('fields=ItemResult.Name%2CCraftType.Name')
    expect(url).toContain('query=ItemResult.Name%7E%22tacos%22')
    expect(url).toContain('limit=6')
  })

  it('builds a sheet row URL with requested fields', () => {
    const url = buildXivapiSheetRowUrl('Recipe', 5604, ['ItemResult.Name', 'RecipeLevelTable.Difficulty'])

    expect(url).toContain('https://v2.xivapi.com/api/sheet/Recipe/5604?')
    expect(url).toContain('language=en')
    expect(url).toContain('fields=ItemResult.Name%2CRecipeLevelTable.Difficulty')
  })
})
