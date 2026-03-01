import { describe, expect, it } from 'vitest'
import { buildXivapiSearchUrl } from './xivapi'

describe('buildXivapiSearchUrl', () => {
  it('builds a search URL for XIVAPI v2', () => {
    const url = buildXivapiSearchUrl('rainbow drip', 'Action', 10)

    expect(url).toContain('https://v2.xivapi.com/api/search?')
    expect(url).toContain('sheets=Action')
    expect(url).toContain('fields=Name')
    expect(url).toContain('limit=10')
    expect(url).toContain('language=en')
    expect(url).toContain('query=Name%7E%22rainbow+drip%22')
  })
})
