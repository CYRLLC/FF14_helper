import { describe, expect, it } from 'vitest'
import {
  buildMacroChunks,
  createDefaultCraftRecipe,
  createDefaultCraftStats,
  parseMacroText,
  simulateCraft,
} from './simulator'

describe('craft simulator', () => {
  it('advances progress with synthesis actions', () => {
    const result = simulateCraft(createDefaultCraftStats(), createDefaultCraftRecipe(), [
      'muscleMemory',
      'veneration',
      'groundwork',
    ])

    expect(result.finalState.progress).toBeGreaterThan(0)
    expect(result.steps.every((step) => step.isValid)).toBe(true)
  })

  it('builds quality with touch actions and consumes inner quiet on byregot', () => {
    const result = simulateCraft(createDefaultCraftStats(), createDefaultCraftRecipe(), [
      'reflect',
      'innovation',
      'greatStrides',
      'preparatoryTouch',
      'byregotsBlessing',
    ])

    expect(result.finalState.quality).toBeGreaterThan(0)
    expect(result.finalState.innerQuiet).toBe(0)
  })

  it('splits macro output into 15-line chunks and parses macro text back', () => {
    const sequence = new Array(16).fill('basicSynthesis') as Array<'basicSynthesis'>
    const chunks = buildMacroChunks(sequence)
    const parsed = parseMacroText(chunks.flat().join('\n'))

    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(15)
    expect(parsed).toHaveLength(16)
  })
})
