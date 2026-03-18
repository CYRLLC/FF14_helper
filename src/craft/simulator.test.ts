import { describe, expect, it } from 'vitest'
import {
  buildMacroChunks,
  createDefaultCraftRecipe,
  createDefaultCraftStats,
  parseMacroText,
  simulateCraft,
  type CraftRecipe,
  type CraftStats,
} from './simulator'

const defaultStats = createDefaultCraftStats()
const defaultRecipe = createDefaultCraftRecipe()

/** 低等配方，職等 100 比 level 10 高出 >= 10 */
const lowLevelRecipe: CraftRecipe = {
  ...defaultRecipe,
  name: '低等測試配方',
  level: 50,
  difficulty: 1000,
  quality: 3000,
}

/** Specialist 屬性 */
const specialistStats: CraftStats = { ...defaultStats, specialist: true }

describe('craft simulator — existing actions', () => {
  it('advances progress with synthesis actions', () => {
    const result = simulateCraft(defaultStats, defaultRecipe, [
      'muscleMemory',
      'veneration',
      'groundwork',
    ])

    expect(result.finalState.progress).toBeGreaterThan(0)
    expect(result.steps.every((step) => step.isValid)).toBe(true)
  })

  it('builds quality with touch actions and consumes inner quiet on byregot', () => {
    const result = simulateCraft(defaultStats, defaultRecipe, [
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

describe('craft simulator — Tricks of the Trade', () => {
  it('restores 20 CP on Good condition', () => {
    // favorable 模式：第 4 步結束後 condition 變 Good，第 5 步開始時為 Good
    const result = simulateCraft(
      defaultStats,
      defaultRecipe,
      ['observe', 'observe', 'observe', 'observe', 'tricksOfTheTrade'],
      { conditionMode: 'favorable' },
    )
    const step = result.steps[4]
    expect(step.isValid).toBe(true)
    expect(step.cpChange).toBe(20)
  })

  it('rejects Tricks of the Trade on normal condition', () => {
    const result = simulateCraft(defaultStats, defaultRecipe, ['tricksOfTheTrade'])
    expect(result.steps[0].isValid).toBe(false)
  })
})

describe('craft simulator — Refined Touch', () => {
  it('grants +1 IQ on normal use', () => {
    const result = simulateCraft(defaultStats, defaultRecipe, ['reflect', 'refinedTouch'])
    const after = result.finalState.innerQuiet
    // reflect gives 2, refinedTouch without combo gives 1 more → 3
    expect(after).toBe(3)
  })

  it('grants +2 IQ when used after Basic Touch (combo)', () => {
    const result = simulateCraft(defaultStats, defaultRecipe, ['basicTouch', 'refinedTouch'])
    // basicTouch +1 IQ → 1, refinedTouch combo +2 IQ → 3
    expect(result.finalState.innerQuiet).toBe(3)
  })
})

describe('craft simulator — Final Appraisal', () => {
  it('prevents craft completion and consumes buff', () => {
    // 用一個容易完工的小配方
    const easyRecipe: CraftRecipe = {
      ...defaultRecipe,
      difficulty: 200,
      quality: 1000,
      durability: 60,
    }
    const result = simulateCraft(defaultStats, easyRecipe, [
      'finalAppraisal',
      'carefulSynthesis', // 通常足以完工
    ])
    // 使用 finalAppraisal 後，carefulsyn 不應讓進度 >= difficulty
    const progressAfterCareful = result.steps[1].resultingState.progress
    expect(progressAfterCareful).toBeLessThan(easyRecipe.difficulty)
    // buff 應已消耗
    expect(result.steps[1].resultingState.buffs.finalAppraisal).toBe(0)
  })

  it('rejects duplicate Final Appraisal while active', () => {
    const result = simulateCraft(defaultStats, defaultRecipe, [
      'finalAppraisal',
      'finalAppraisal',
    ])
    expect(result.steps[1].isValid).toBe(false)
  })
})

describe('craft simulator — Trained Eye', () => {
  it('maximises quality when level gap >= 10', () => {
    const result = simulateCraft(defaultStats, lowLevelRecipe, ['trainedEye'])
    expect(result.finalState.quality).toBe(lowLevelRecipe.quality)
    expect(result.steps[0].isValid).toBe(true)
  })

  it('rejects Trained Eye when level gap < 10', () => {
    const highLevelRecipe: CraftRecipe = { ...defaultRecipe, level: 95 }
    // 職等 100，配方 95，差距 5 < 10
    const result = simulateCraft(defaultStats, highLevelRecipe, ['trainedEye'])
    expect(result.steps[0].isValid).toBe(false)
  })

  it('rejects Trained Eye after first step', () => {
    const result = simulateCraft(defaultStats, lowLevelRecipe, ['observe', 'trainedEye'])
    expect(result.steps[1].isValid).toBe(false)
  })
})

describe('craft simulator — Specialist skills', () => {
  it('rejects specialist skills for non-specialist', () => {
    const results = [
      simulateCraft(defaultStats, defaultRecipe, ['heartAndSoul']),
      simulateCraft(defaultStats, defaultRecipe, ['immaculateMend']),
      simulateCraft(defaultStats, defaultRecipe, ['trainedPerfection']),
      simulateCraft(defaultStats, defaultRecipe, ['quickInnovation']),
    ]
    for (const r of results) {
      expect(r.steps[0].isValid).toBe(false)
    }
  })

  it('allows specialist skills for specialist', () => {
    const result = simulateCraft(specialistStats, defaultRecipe, ['heartAndSoul'])
    expect(result.steps[0].isValid).toBe(true)
  })

  it('Heart and Soul allows Intensive Synthesis on normal condition', () => {
    const result = simulateCraft(specialistStats, defaultRecipe, [
      'heartAndSoul',
      'intensiveSynthesis',
    ])
    // 正常條件下 IntensiveSynthesis 不可用，但 HAS 開啟後應可用
    expect(result.steps[1].isValid).toBe(true)
  })

  it('Heart and Soul can only be used once per craft', () => {
    const result = simulateCraft(specialistStats, defaultRecipe, [
      'heartAndSoul',
      'heartAndSoul',
    ])
    expect(result.steps[1].isValid).toBe(false)
  })

  it('Immaculate Mend restores full durability', () => {
    const result = simulateCraft(specialistStats, defaultRecipe, [
      'groundwork', // 消耗 20 耐久
      'groundwork',
      'immaculateMend',
    ])
    expect(result.finalState.durability).toBe(defaultRecipe.durability)
  })

  it('Trained Perfection next durability action costs 0', () => {
    const result = simulateCraft(specialistStats, defaultRecipe, [
      'trainedPerfection',
      'groundwork', // 通常消耗 20 耐久，Trained Perfection 後應免費
    ])
    const durAfterGroundwork = result.steps[1].resultingState.durability
    // durability 不應減少（Manipulation 也沒有開，所以不加回）
    expect(durAfterGroundwork).toBe(defaultRecipe.durability)
    expect(result.steps[1].resultingState.buffs.trainedPerfectionReady).toBe(false)
  })

  it('Trained Perfection can only be used once per craft', () => {
    const result = simulateCraft(specialistStats, defaultRecipe, [
      'trainedPerfection',
      'basicSynthesis',
      'trainedPerfection',
    ])
    expect(result.steps[2].isValid).toBe(false)
  })

  it('Quick Innovation grants innovation buff once per craft', () => {
    const result = simulateCraft(specialistStats, defaultRecipe, ['quickInnovation'])
    expect(result.steps[0].isValid).toBe(true)
    // buff 設為 2，decrement 後為 1，表示還剩 1 回合
    expect(result.steps[0].resultingState.buffs.innovation).toBeGreaterThan(0)

    const result2 = simulateCraft(specialistStats, defaultRecipe, [
      'quickInnovation',
      'basicTouch',
      'quickInnovation',
    ])
    expect(result2.steps[2].isValid).toBe(false)
  })
})

describe('craft simulator — probabilistic actions', () => {
  it('Rapid Synthesis advances progress (assumed success)', () => {
    const result = simulateCraft(defaultStats, defaultRecipe, ['rapidSynthesis'])
    expect(result.steps[0].isValid).toBe(true)
    expect(result.steps[0].progressGain).toBeGreaterThan(0)
    expect(result.steps[0].note).toContain('機率技能')
  })

  it('Hasty Touch advances quality (assumed success)', () => {
    const result = simulateCraft(defaultStats, defaultRecipe, ['hastyTouch'])
    expect(result.steps[0].isValid).toBe(true)
    expect(result.steps[0].qualityGain).toBeGreaterThan(0)
  })

  it('Daring Touch requires Hasty Touch before it', () => {
    const rejectResult = simulateCraft(defaultStats, defaultRecipe, ['daringTouch'])
    expect(rejectResult.steps[0].isValid).toBe(false)

    const acceptResult = simulateCraft(defaultStats, defaultRecipe, ['hastyTouch', 'daringTouch'])
    expect(acceptResult.steps[1].isValid).toBe(true)
  })

  it('Daring Touch is available during Heart and Soul', () => {
    const result = simulateCraft(specialistStats, defaultRecipe, [
      'heartAndSoul',
      'daringTouch',
    ])
    expect(result.steps[1].isValid).toBe(true)
  })
})

describe('craft simulator — macro parsing for new actions', () => {
  it('parses all new action macroNames correctly', () => {
    const macroText = [
      '/ac "Tricks of the Trade" <wait.3>',
      '/ac "Refined Touch" <wait.3>',
      '/ac "Final Appraisal" <wait.2>',
      '/ac "Trained Eye" <wait.3>',
      '/ac "Rapid Synthesis" <wait.3>',
      '/ac "Hasty Touch" <wait.3>',
      '/ac "Daring Touch" <wait.3>',
    ].join('\n')

    const parsed = parseMacroText(macroText)
    expect(parsed).toEqual([
      'tricksOfTheTrade',
      'refinedTouch',
      'finalAppraisal',
      'trainedEye',
      'rapidSynthesis',
      'hastyTouch',
      'daringTouch',
    ])
  })
})
