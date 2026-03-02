import { describe, expect, it } from 'vitest'
import { buildUniversalisUrl } from './universalis'

describe('buildUniversalisUrl', () => {
  it('builds a Universalis URL for a data center scope', () => {
    const url = buildUniversalisUrl(
      {
        region: 'JP',
        mode: 'dc',
        scopeKey: 'Elemental',
      },
      5333,
      { entries: 20, listings: 20 },
    )

    expect(url).toBe('https://universalis.app/api/v2/Elemental/5333?entries=20&listings=20')
  })

  it('encodes world names with spaces safely', () => {
    const url = buildUniversalisUrl(
      {
        region: 'NA',
        mode: 'world',
        scopeKey: 'Adamantoise Prime',
      },
      42,
    )

    expect(url).toContain('/Adamantoise%20Prime/42?')
  })
})
