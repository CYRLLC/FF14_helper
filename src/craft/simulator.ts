export type CraftActionId =
  | 'reflect'
  | 'muscleMemory'
  | 'veneration'
  | 'basicSynthesis'
  | 'carefulSynthesis'
  | 'groundwork'
  | 'prudentSynthesis'
  | 'delicateSynthesis'
  | 'focusedSynthesis'
  | 'intensiveSynthesis'
  | 'innovation'
  | 'greatStrides'
  | 'basicTouch'
  | 'standardTouch'
  | 'advancedTouch'
  | 'prudentTouch'
  | 'preparatoryTouch'
  | 'focusedTouch'
  | 'preciseTouch'
  | 'byregotsBlessing'
  | 'trainedFinesse'
  | 'wasteNot'
  | 'wasteNotII'
  | 'manipulation'
  | 'mastersMend'
  | 'observe'
  | 'tricksOfTheTrade'
  | 'refinedTouch'
  | 'finalAppraisal'
  | 'trainedEye'
  | 'heartAndSoul'
  | 'immaculateMend'
  | 'trainedPerfection'
  | 'quickInnovation'
  | 'rapidSynthesis'
  | 'hastyTouch'
  | 'daringTouch'

type CraftActionKind = 'synthesis' | 'touch' | 'buff' | 'repair' | 'utility'

export type CraftCondition = 'normal' | 'good' | 'excellent' | 'poor'
export type CraftConditionMode = 'normal' | 'favorable'
export type CraftSolverObjective = 'balanced' | 'quality' | 'completion'

export interface CraftStats {
  level: number
  craftsmanship: number
  control: number
  cp: number
  specialist?: boolean
}

export interface CraftRecipe {
  name: string
  level: number
  difficulty: number
  quality: number
  durability: number
  progressDivider: number
  progressModifier: number
  qualityDivider: number
  qualityModifier: number
  initialQuality: number
  jobName?: string
  canHq?: boolean
  yield?: number
  source?: string
  ingredients?: Array<{ name: string; amount: number }>
}

export interface CraftActionDefinition {
  id: CraftActionId
  label: string
  macroName: string
  kind: CraftActionKind
  cpCost: number
  durabilityCost: number
  description: string
  progressPotency?: number
  qualityPotency?: number
  buffDuration?: number
  firstOnly?: boolean
  /** 動作成功率非 100%（模擬時假設成功）*/
  probabilistic?: boolean
  /** 僅限 Specialist 職業使用 */
  specialistOnly?: boolean
}

export interface CraftBuffState {
  veneration: number
  innovation: number
  greatStrides: number
  wasteNot: number
  manipulation: number
  muscleMemory: number
  observed: boolean
  /** Final Appraisal 剩餘回合 */
  finalAppraisal: number
  /** Heart and Soul 剩餘回合（Specialist 限定）*/
  heartAndSoul: number
  /** Heart and Soul 是否已使用（每次製作只能用一次）*/
  heartAndSoulUsed: boolean
  /** Trained Perfection 待觸發旗標（下一個消耗耐久的動作免費）*/
  trainedPerfectionReady: boolean
  /** Trained Perfection 是否已使用（每次製作只能用一次）*/
  trainedPerfectionUsed: boolean
  /** Quick Innovation 是否已使用（每次製作只能用一次，Specialist 限定）*/
  quickInnovationUsed: boolean
}

export interface CraftState {
  progress: number
  quality: number
  durability: number
  cp: number
  innerQuiet: number
  buffs: CraftBuffState
  step: number
  lastActionId: CraftActionId | null
  status: 'running' | 'completed' | 'broken'
  condition: CraftCondition
}

export interface CraftSimulationStep {
  actionId: CraftActionId
  actionLabel: string
  isValid: boolean
  note: string | null
  progressGain: number
  qualityGain: number
  durabilityChange: number
  cpChange: number
  condition: CraftCondition
  resultingState: CraftState
}

export interface CraftSimulationResult {
  initialState: CraftState
  steps: CraftSimulationStep[]
  finalState: CraftState
  completionPercent: number
  qualityPercent: number
  hqPercent: number
}

export interface CraftRecipePreset {
  id: string
  label: string
  note: string
  recipe: CraftRecipe
}

export interface CraftSimulationOptions {
  conditionMode?: CraftConditionMode
}

export interface CraftSolverOptions extends CraftSimulationOptions {
  objective?: CraftSolverObjective
  maxSteps?: number
  beamWidth?: number
}

export interface CraftSolverResult {
  sequence: CraftActionId[]
  simulation: CraftSimulationResult
  objective: CraftSolverObjective
  exploredStates: number
  notes: string[]
}

const MAX_INNER_QUIET = 10

/** FFXIV 標準 HQ 機率表（索引 0–90 對應品質 0–90%，之後視為 100%） */
const hqProbTable = [
  1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5,
  5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15,
  15, 16, 17, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27, 28, 30, 31, 33, 35, 36, 38,
  40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 61, 63, 65, 68, 71, 74, 77, 80, 83, 86,
  89, 92, 94, 95, 96, 97, 98, 99, 99, 99, 100,
]

function calcHqPercent(qualityPercent: number): number {
  if (qualityPercent >= 100) return 100
  if (qualityPercent <= 0) return 0
  return hqProbTable[Math.min(90, Math.floor(qualityPercent))]
}

export const craftActionDefinitions: CraftActionDefinition[] = [
  {
    id: 'reflect',
    label: 'Reflect',
    macroName: 'Reflect',
    kind: 'touch',
    cpCost: 6,
    durabilityCost: 10,
    qualityPotency: 300,
    description: '起手高品質動作，直接給 2 層 Inner Quiet。',
    firstOnly: true,
  },
  {
    id: 'muscleMemory',
    label: 'Muscle Memory',
    macroName: 'Muscle Memory',
    kind: 'synthesis',
    cpCost: 6,
    durabilityCost: 10,
    progressPotency: 300,
    description: '起手進度動作，下一個進度技能會吃到雙倍加成。',
    firstOnly: true,
  },
  {
    id: 'trainedEye',
    label: 'Trained Eye',
    macroName: 'Trained Eye',
    kind: 'touch',
    cpCost: 250,
    durabilityCost: 10,
    qualityPotency: 0,
    description: '職等高於配方等級 10 以上時，第一手直接最大化品質。',
    firstOnly: true,
  },
  {
    id: 'veneration',
    label: 'Veneration',
    macroName: 'Veneration',
    kind: 'buff',
    cpCost: 18,
    durabilityCost: 0,
    buffDuration: 4,
    description: '4 回合內進度技能效率提高。',
  },
  {
    id: 'innovation',
    label: 'Innovation',
    macroName: 'Innovation',
    kind: 'buff',
    cpCost: 18,
    durabilityCost: 0,
    buffDuration: 4,
    description: '4 回合內品質技能效率提高。',
  },
  {
    id: 'greatStrides',
    label: 'Great Strides',
    macroName: 'Great Strides',
    kind: 'buff',
    cpCost: 32,
    durabilityCost: 0,
    buffDuration: 3,
    description: '下一個品質技能額外提升。',
  },
  {
    id: 'wasteNot',
    label: 'Waste Not',
    macroName: 'Waste Not',
    kind: 'buff',
    cpCost: 56,
    durabilityCost: 0,
    buffDuration: 4,
    description: '4 回合內耐久消耗減半。',
  },
  {
    id: 'wasteNotII',
    label: 'Waste Not II',
    macroName: 'Waste Not II',
    kind: 'buff',
    cpCost: 98,
    durabilityCost: 0,
    buffDuration: 8,
    description: '8 回合內耐久消耗減半。',
  },
  {
    id: 'manipulation',
    label: 'Manipulation',
    macroName: 'Manipulation',
    kind: 'buff',
    cpCost: 96,
    durabilityCost: 0,
    buffDuration: 8,
    description: '接下來每回合恢復 5 耐久。',
  },
  {
    id: 'finalAppraisal',
    label: 'Final Appraisal',
    macroName: 'Final Appraisal',
    kind: 'buff',
    cpCost: 1,
    durabilityCost: 0,
    buffDuration: 5,
    description: '5 回合內進度技能到達完工點時，改留 1 點進度未完成，防止提前完工。',
  },
  {
    id: 'quickInnovation',
    label: 'Quick Innovation',
    macroName: 'Quick Innovation',
    kind: 'buff',
    cpCost: 0,
    durabilityCost: 0,
    description: '（Specialist）每次製作限用一次，立即獲得 1 層 Innovation 加成。',
    specialistOnly: true,
  },
  {
    id: 'basicSynthesis',
    label: 'Basic Synthesis',
    macroName: 'Basic Synthesis',
    kind: 'synthesis',
    cpCost: 0,
    durabilityCost: 10,
    progressPotency: 120,
    description: '基礎進度動作。',
  },
  {
    id: 'carefulSynthesis',
    label: 'Careful Synthesis',
    macroName: 'Careful Synthesis',
    kind: 'synthesis',
    cpCost: 7,
    durabilityCost: 10,
    progressPotency: 180,
    description: '較穩定的進度動作。',
  },
  {
    id: 'groundwork',
    label: 'Groundwork',
    macroName: 'Groundwork',
    kind: 'synthesis',
    cpCost: 18,
    durabilityCost: 20,
    progressPotency: 300,
    description: '高威力進度動作；耐久不足時威力減半。',
  },
  {
    id: 'prudentSynthesis',
    label: 'Prudent Synthesis',
    macroName: 'Prudent Synthesis',
    kind: 'synthesis',
    cpCost: 18,
    durabilityCost: 5,
    progressPotency: 180,
    description: '低耐久消耗進度動作；Waste Not 期間不可用。',
  },
  {
    id: 'delicateSynthesis',
    label: 'Delicate Synthesis',
    macroName: 'Delicate Synthesis',
    kind: 'synthesis',
    cpCost: 32,
    durabilityCost: 10,
    progressPotency: 100,
    qualityPotency: 100,
    description: '同時推進進度與品質。',
  },
  {
    id: 'focusedSynthesis',
    label: 'Focused Synthesis',
    macroName: 'Focused Synthesis',
    kind: 'synthesis',
    cpCost: 5,
    durabilityCost: 10,
    progressPotency: 200,
    description: 'Observe 後才能使用的高效率進度動作。',
  },
  {
    id: 'intensiveSynthesis',
    label: 'Intensive Synthesis',
    macroName: 'Intensive Synthesis',
    kind: 'synthesis',
    cpCost: 6,
    durabilityCost: 10,
    progressPotency: 400,
    description: '僅在 Good / Excellent 條件下可用的高爆發進度動作（Heart and Soul 期間任何條件可用）。',
  },
  {
    id: 'rapidSynthesis',
    label: 'Rapid Synthesis',
    macroName: 'Rapid Synthesis',
    kind: 'synthesis',
    cpCost: 0,
    durabilityCost: 10,
    progressPotency: 500,
    description: '0 CP 高威力進度動作，但有機率失敗（模擬時假設成功）。',
    probabilistic: true,
  },
  {
    id: 'basicTouch',
    label: 'Basic Touch',
    macroName: 'Basic Touch',
    kind: 'touch',
    cpCost: 18,
    durabilityCost: 10,
    qualityPotency: 100,
    description: '基礎品質動作。',
  },
  {
    id: 'standardTouch',
    label: 'Standard Touch',
    macroName: 'Standard Touch',
    kind: 'touch',
    cpCost: 32,
    durabilityCost: 10,
    qualityPotency: 125,
    description: 'Basic Touch 後會變成便宜連段。',
  },
  {
    id: 'advancedTouch',
    label: 'Advanced Touch',
    macroName: 'Advanced Touch',
    kind: 'touch',
    cpCost: 46,
    durabilityCost: 10,
    qualityPotency: 150,
    description: 'Standard Touch 後會變成便宜連段。',
  },
  {
    id: 'refinedTouch',
    label: 'Refined Touch',
    macroName: 'Refined Touch',
    kind: 'touch',
    cpCost: 24,
    durabilityCost: 10,
    qualityPotency: 100,
    description: 'Basic Touch 後使用時，額外多獲得 1 層 Inner Quiet（共 +2 層）。',
  },
  {
    id: 'prudentTouch',
    label: 'Prudent Touch',
    macroName: 'Prudent Touch',
    kind: 'touch',
    cpCost: 25,
    durabilityCost: 5,
    qualityPotency: 100,
    description: '低耐久消耗品質動作；Waste Not 期間不可用。',
  },
  {
    id: 'preparatoryTouch',
    label: 'Preparatory Touch',
    macroName: 'Preparatory Touch',
    kind: 'touch',
    cpCost: 40,
    durabilityCost: 20,
    qualityPotency: 200,
    description: '高威力品質動作，直接增加 2 層 Inner Quiet。',
  },
  {
    id: 'focusedTouch',
    label: 'Focused Touch',
    macroName: 'Focused Touch',
    kind: 'touch',
    cpCost: 18,
    durabilityCost: 10,
    qualityPotency: 150,
    description: 'Observe 後才能使用的高效率品質動作。',
  },
  {
    id: 'preciseTouch',
    label: 'Precise Touch',
    macroName: 'Precise Touch',
    kind: 'touch',
    cpCost: 18,
    durabilityCost: 10,
    qualityPotency: 150,
    description: '僅在 Good / Excellent 條件下可用，直接增加 2 層 Inner Quiet（Heart and Soul 期間任何條件可用）。',
  },
  {
    id: 'byregotsBlessing',
    label: "Byregot's Blessing",
    macroName: "Byregot's Blessing",
    kind: 'touch',
    cpCost: 24,
    durabilityCost: 10,
    qualityPotency: 100,
    description: '收尾品質動作，吃掉全部 Inner Quiet。',
  },
  {
    id: 'trainedFinesse',
    label: 'Trained Finesse',
    macroName: 'Trained Finesse',
    kind: 'touch',
    cpCost: 32,
    durabilityCost: 0,
    qualityPotency: 100,
    description: '需要 10 層 Inner Quiet，0 耐久消耗。',
  },
  {
    id: 'hastyTouch',
    label: 'Hasty Touch',
    macroName: 'Hasty Touch',
    kind: 'touch',
    cpCost: 0,
    durabilityCost: 10,
    qualityPotency: 100,
    description: '0 CP 品質動作，但有機率失敗（模擬時假設成功）。',
    probabilistic: true,
  },
  {
    id: 'daringTouch',
    label: 'Daring Touch',
    macroName: 'Daring Touch',
    kind: 'touch',
    cpCost: 0,
    durabilityCost: 10,
    qualityPotency: 150,
    description: 'Hasty Touch 成功後或 Heart and Soul 期間可用，機率技（模擬時假設成功）。',
    probabilistic: true,
  },
  {
    id: 'tricksOfTheTrade',
    label: 'Tricks of the Trade',
    macroName: 'Tricks of the Trade',
    kind: 'utility',
    cpCost: 0,
    durabilityCost: 0,
    description: 'Good / Excellent 條件下使用，恢復 20 CP（Heart and Soul 期間任何條件可用）。',
  },
  {
    id: 'mastersMend',
    label: "Master's Mend",
    macroName: "Master's Mend",
    kind: 'repair',
    cpCost: 88,
    durabilityCost: 0,
    description: '立即恢復 30 耐久。',
  },
  {
    id: 'immaculateMend',
    label: 'Immaculate Mend',
    macroName: 'Immaculate Mend',
    kind: 'repair',
    cpCost: 0,
    durabilityCost: 0,
    description: '（Specialist）立即將耐久恢復至最大值。',
    specialistOnly: true,
  },
  {
    id: 'trainedPerfection',
    label: 'Trained Perfection',
    macroName: 'Trained Perfection',
    kind: 'utility',
    cpCost: 0,
    durabilityCost: 0,
    description: '（Specialist）每次製作限用一次，下一個消耗耐久的動作不消耗耐久。',
    specialistOnly: true,
  },
  {
    id: 'observe',
    label: 'Observe',
    macroName: 'Observe',
    kind: 'utility',
    cpCost: 7,
    durabilityCost: 0,
    description: '等待一回合，讓 Focused 系列動作可用。',
  },
  {
    id: 'heartAndSoul',
    label: 'Heart and Soul',
    macroName: 'Heart and Soul',
    kind: 'buff',
    cpCost: 0,
    durabilityCost: 0,
    buffDuration: 1,
    description: '（Specialist）每次製作限用一次，下一個動作可忽略 Good / Excellent 條件限制。',
    specialistOnly: true,
  },
]

const solverActionPriority: CraftActionId[] = [
  'trainedEye',
  'muscleMemory',
  'reflect',
  'veneration',
  'innovation',
  'finalAppraisal',
  'wasteNotII',
  'wasteNot',
  'manipulation',
  'groundwork',
  'carefulSynthesis',
  'rapidSynthesis',
  'basicSynthesis',
  'prudentSynthesis',
  'focusedSynthesis',
  'intensiveSynthesis',
  'greatStrides',
  'preparatoryTouch',
  'refinedTouch',
  'focusedTouch',
  'basicTouch',
  'standardTouch',
  'advancedTouch',
  'prudentTouch',
  'preciseTouch',
  'tricksOfTheTrade',
  'delicateSynthesis',
  'trainedFinesse',
  'byregotsBlessing',
  'immaculateMend',
  'mastersMend',
  'observe',
]

const actionMap = new Map(craftActionDefinitions.map((action) => [action.id, action]))

export const craftRecipePresets: CraftRecipePreset[] = [
  {
    id: 'dt-100-hard',
    label: '7.x 100 級高難度',
    note: '依 BestCraft 常見高難示例整理，適合測試完整 rotations。',
    recipe: {
      name: '7.x 高難度示例配方',
      level: 100,
      difficulty: 8050,
      quality: 17600,
      durability: 70,
      progressDivider: 170,
      progressModifier: 90,
      qualityDivider: 150,
      qualityModifier: 75,
      initialQuality: 0,
      canHq: true,
      yield: 1,
      source: '站內預設',
    },
  },
  {
    id: 'collectable-70',
    label: '收藏品 70 耐久',
    note: '適合收藏品與 Custom Deliveries 類型流程。',
    recipe: {
      name: '收藏品示例配方',
      level: 100,
      difficulty: 6200,
      quality: 14000,
      durability: 70,
      progressDivider: 160,
      progressModifier: 100,
      qualityDivider: 140,
      qualityModifier: 100,
      initialQuality: 0,
      canHq: false,
      yield: 1,
      source: '站內預設',
    },
  },
  {
    id: 'quick-40',
    label: '40 耐久一般配方',
    note: '適合快速測試短 rotation 與 solver。',
    recipe: {
      name: '40 耐久示例配方',
      level: 100,
      difficulty: 3900,
      quality: 9800,
      durability: 40,
      progressDivider: 130,
      progressModifier: 100,
      qualityDivider: 120,
      qualityModifier: 100,
      initialQuality: 0,
      canHq: true,
      yield: 1,
      source: '站內預設',
    },
  },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getConditionMultiplier(condition: CraftCondition): number {
  switch (condition) {
    case 'good':
      return 1.5
    case 'excellent':
      return 4
    case 'poor':
      return 0.5
    default:
      return 1
  }
}

function getNextCondition(current: CraftCondition, nextStep: number, mode: CraftConditionMode): CraftCondition {
  if (current === 'excellent') {
    return 'poor'
  }

  if (mode === 'normal') {
    return 'normal'
  }

  if (nextStep > 0 && nextStep % 8 === 0) {
    return 'excellent'
  }

  if (nextStep > 0 && nextStep % 4 === 0) {
    return 'good'
  }

  return 'normal'
}

function getActionById(actionId: CraftActionId): CraftActionDefinition {
  const action = actionMap.get(actionId)
  if (!action) {
    throw new Error(`Unknown craft action: ${actionId}`)
  }

  return action
}

function createInitialBuffs(): CraftBuffState {
  return {
    veneration: 0,
    innovation: 0,
    greatStrides: 0,
    wasteNot: 0,
    manipulation: 0,
    muscleMemory: 0,
    observed: false,
    finalAppraisal: 0,
    heartAndSoul: 0,
    heartAndSoulUsed: false,
    trainedPerfectionReady: false,
    trainedPerfectionUsed: false,
    quickInnovationUsed: false,
  }
}

function createInitialState(stats: CraftStats, recipe: CraftRecipe): CraftState {
  return {
    progress: 0,
    quality: clamp(recipe.initialQuality, 0, recipe.quality),
    durability: recipe.durability,
    cp: stats.cp,
    innerQuiet: 0,
    buffs: createInitialBuffs(),
    step: 0,
    lastActionId: null,
    status: 'running',
    condition: 'normal',
  }
}

function getBaseProgress(stats: CraftStats, recipe: CraftRecipe): number {
  return Math.max(1, Math.floor((stats.craftsmanship * 10) / recipe.progressDivider + 2))
}

function getBaseQuality(stats: CraftStats, recipe: CraftRecipe): number {
  return Math.max(1, Math.floor((stats.control * 10) / recipe.qualityDivider + 35))
}

function decrementBuffs(buffs: CraftBuffState): CraftBuffState {
  return {
    veneration: Math.max(0, buffs.veneration - 1),
    innovation: Math.max(0, buffs.innovation - 1),
    greatStrides: Math.max(0, buffs.greatStrides - 1),
    wasteNot: Math.max(0, buffs.wasteNot - 1),
    manipulation: Math.max(0, buffs.manipulation - 1),
    muscleMemory: Math.max(0, buffs.muscleMemory - 1),
    observed: false,
    finalAppraisal: Math.max(0, buffs.finalAppraisal - 1),
    heartAndSoul: Math.max(0, buffs.heartAndSoul - 1),
    // 以下為永久旗標，decrementBuffs 不修改
    heartAndSoulUsed: buffs.heartAndSoulUsed,
    trainedPerfectionReady: buffs.trainedPerfectionReady,
    trainedPerfectionUsed: buffs.trainedPerfectionUsed,
    quickInnovationUsed: buffs.quickInnovationUsed,
  }
}

function isConditionGatedAction(actionId: CraftActionId): boolean {
  return actionId === 'intensiveSynthesis' || actionId === 'preciseTouch' || actionId === 'tricksOfTheTrade' || actionId === 'daringTouch'
}

function getAdjustedDurabilityCost(action: CraftActionDefinition, state: CraftState): number {
  if (action.durabilityCost === 0) {
    return 0
  }

  if (state.buffs.trainedPerfectionReady) {
    return 0
  }

  return state.buffs.wasteNot > 0 ? Math.ceil(action.durabilityCost / 2) : action.durabilityCost
}

function getAdjustedCpCost(action: CraftActionDefinition, state: CraftState): number {
  if (action.id === 'standardTouch' && state.lastActionId === 'basicTouch') {
    return 18
  }

  if (action.id === 'advancedTouch' && state.lastActionId === 'standardTouch') {
    return 18
  }

  return action.cpCost
}

function buildInvalidResult(action: CraftActionDefinition, state: CraftState, note: string): CraftSimulationStep {
  return {
    actionId: action.id,
    actionLabel: action.label,
    isValid: false,
    note,
    progressGain: 0,
    qualityGain: 0,
    durabilityChange: 0,
    cpChange: 0,
    condition: state.condition,
    resultingState: {
      ...state,
      step: state.step + 1,
      lastActionId: action.id,
      status: state.status === 'completed' ? 'completed' : 'broken',
    },
  }
}

function validateAction(action: CraftActionDefinition, state: CraftState, stats: CraftStats, recipe: CraftRecipe): string | null {
  if (state.status !== 'running') {
    return '製作已經結束，不能再追加動作。'
  }

  if (action.specialistOnly && !stats.specialist) {
    return `${action.label} 只能由 Specialist 職業使用。`
  }

  if (action.firstOnly && state.step > 0) {
    return `${action.label} 只能在第一手使用。`
  }

  if (action.id === 'trainedEye' && stats.level < recipe.level + 10) {
    return `Trained Eye 需要職等（${stats.level}）至少比配方等級（${recipe.level}）高 10 級。`
  }

  if (action.id === 'byregotsBlessing' && state.innerQuiet === 0) {
    return "Byregot's Blessing 需要至少 1 層 Inner Quiet。"
  }

  if (action.id === 'trainedFinesse' && state.innerQuiet < 10) {
    return 'Trained Finesse 需要 10 層 Inner Quiet。'
  }

  if ((action.id === 'focusedSynthesis' || action.id === 'focusedTouch') && !state.buffs.observed) {
    return 'Focused 系列動作必須接在 Observe 後面。'
  }

  if ((action.id === 'prudentSynthesis' || action.id === 'prudentTouch') && state.buffs.wasteNot > 0) {
    return 'Prudent 系列動作在 Waste Not 期間不可用。'
  }

  const conditionAllowed = state.buffs.heartAndSoul > 0 || state.condition === 'good' || state.condition === 'excellent'
  if ((action.id === 'intensiveSynthesis' || action.id === 'preciseTouch') && !conditionAllowed) {
    return `${action.label} 只會在 Good / Excellent 條件下成立（或 Heart and Soul 期間）。`
  }

  if (action.id === 'tricksOfTheTrade' && !conditionAllowed) {
    return 'Tricks of the Trade 需要 Good / Excellent 條件（或 Heart and Soul 期間）。'
  }

  if (action.id === 'daringTouch' && state.lastActionId !== 'hastyTouch' && state.buffs.heartAndSoul === 0) {
    return 'Daring Touch 必須接在 Hasty Touch 之後，或在 Heart and Soul 期間使用。'
  }

  if (action.id === 'heartAndSoul' && state.buffs.heartAndSoulUsed) {
    return 'Heart and Soul 每次製作只能使用一次。'
  }

  if (action.id === 'trainedPerfection' && state.buffs.trainedPerfectionUsed) {
    return 'Trained Perfection 每次製作只能使用一次。'
  }

  if (action.id === 'quickInnovation' && state.buffs.quickInnovationUsed) {
    return 'Quick Innovation 每次製作只能使用一次。'
  }

  if (action.id === 'finalAppraisal' && state.buffs.finalAppraisal > 0) {
    return 'Final Appraisal 已在生效中。'
  }

  return null
}

function simulateAction(
  stats: CraftStats,
  recipe: CraftRecipe,
  state: CraftState,
  actionId: CraftActionId,
  options: CraftSimulationOptions = {},
): CraftSimulationStep {
  const action = getActionById(actionId)
  const validationError = validateAction(action, state, stats, recipe)
  if (validationError) {
    return buildInvalidResult(action, state, validationError)
  }

  const cpCost = getAdjustedCpCost(action, state)
  const durabilityCost = getAdjustedDurabilityCost(action, state)

  if (state.cp < cpCost) {
    return buildInvalidResult(action, state, 'CP 不足，無法使用這個動作。')
  }

  if (state.durability < durabilityCost && durabilityCost > 0) {
    return buildInvalidResult(action, state, '耐久不足，無法使用這個動作。')
  }

  const nextState: CraftState = {
    ...state,
    cp: state.cp - cpCost,
    durability: state.durability - durabilityCost,
    step: state.step + 1,
    lastActionId: action.id,
    buffs: { ...state.buffs },
  }

  let progressGain = 0
  let qualityGain = 0
  let note: string | null = null

  if (action.probabilistic) {
    note = '機率技能（模擬假設成功）。'
  }

  // ── 修復類 ────────────────────────────────────────────────────────────
  if (action.id === 'mastersMend') {
    nextState.durability = Math.min(recipe.durability, nextState.durability + 30)
  }

  if (action.id === 'immaculateMend') {
    nextState.durability = recipe.durability
  }

  // ── Trained Perfection 消耗 ───────────────────────────────────────────
  if (state.buffs.trainedPerfectionReady && action.durabilityCost > 0) {
    nextState.buffs.trainedPerfectionReady = false
    note = note ? `${note} Trained Perfection 觸發，本動作耐久免費。` : 'Trained Perfection 觸發，本動作耐久免費。'
  }

  // ── Utility 類 ────────────────────────────────────────────────────────
  if (action.id === 'observe') {
    nextState.buffs.observed = true
    note = '下一手可以接 Focused 系列動作。'
  }

  if (action.id === 'tricksOfTheTrade') {
    nextState.cp = Math.min(stats.cp, nextState.cp + 20)
    note = 'CP +20。'
  }

  if (action.id === 'trainedPerfection') {
    nextState.buffs.trainedPerfectionReady = true
    nextState.buffs.trainedPerfectionUsed = true
    note = '下一個消耗耐久的動作免費。'
  }

  // ── Buff 類 ───────────────────────────────────────────────────────────
  if (action.id === 'veneration') {
    nextState.buffs.veneration = (action.buffDuration ?? 0) + 1
  }

  if (action.id === 'innovation') {
    nextState.buffs.innovation = (action.buffDuration ?? 0) + 1
  }

  if (action.id === 'greatStrides') {
    nextState.buffs.greatStrides = (action.buffDuration ?? 0) + 1
  }

  if (action.id === 'wasteNot' || action.id === 'wasteNotII') {
    nextState.buffs.wasteNot = (action.buffDuration ?? 0) + 1
  }

  if (action.id === 'manipulation') {
    nextState.buffs.manipulation = (action.buffDuration ?? 0) + 1
  }

  if (action.id === 'muscleMemory') {
    nextState.buffs.muscleMemory = 6
  }

  if (action.id === 'finalAppraisal') {
    nextState.buffs.finalAppraisal = (action.buffDuration ?? 0) + 1
  }

  if (action.id === 'heartAndSoul') {
    nextState.buffs.heartAndSoul = (action.buffDuration ?? 0) + 1
    nextState.buffs.heartAndSoulUsed = true
  }

  if (action.id === 'quickInnovation') {
    // 立即給 1 層 Innovation（設為 2：decrement 後為 1，下一個動作生效，之後歸零）
    nextState.buffs.innovation = Math.max(nextState.buffs.innovation, 2)
    nextState.buffs.quickInnovationUsed = true
    note = 'Innovation +1 層（本次 Quick Innovation）。'
  }

  // ── Heart and Soul 消耗（條件限定技能使用後）────────────────────────
  if (state.buffs.heartAndSoul > 0 && isConditionGatedAction(action.id)) {
    nextState.buffs.heartAndSoul = 0
  }

  // ── 進度計算 ──────────────────────────────────────────────────────────
  if ((action.progressPotency ?? 0) > 0) {
    const baseProgress = getBaseProgress(stats, recipe)
    let potency = action.progressPotency ?? 0

    if (action.id === 'groundwork' && state.durability < action.durabilityCost) {
      potency = Math.floor(potency / 2)
      note = note ? `${note} Groundwork 因原始耐久不足而觸發半效。` : 'Groundwork 因原始耐久不足而觸發半效。'
    }

    let multiplier = recipe.progressModifier / 100
    if (state.buffs.veneration > 0) {
      multiplier *= 1.5
    }

    if (state.buffs.muscleMemory > 0 && action.id !== 'muscleMemory') {
      multiplier *= 2
      note = note ? `${note} 套用 Muscle Memory 加成。` : '套用 Muscle Memory 加成。'
    }

    progressGain = Math.floor(baseProgress * (potency / 100) * multiplier)

    // Final Appraisal：防止進度到達完工值
    if (state.buffs.finalAppraisal > 0 && nextState.progress + progressGain >= recipe.difficulty) {
      progressGain = Math.max(0, recipe.difficulty - 1 - nextState.progress)
      nextState.buffs.finalAppraisal = 0
      note = note ? `${note} Final Appraisal 觸發，進度保留 1 點。` : 'Final Appraisal 觸發，進度保留 1 點。'
    }

    nextState.progress = clamp(nextState.progress + progressGain, 0, recipe.difficulty)

    if (action.id !== 'muscleMemory') {
      nextState.buffs.muscleMemory = 0
    }
  }

  // ── 品質計算 ──────────────────────────────────────────────────────────
  if (action.id === 'trainedEye') {
    // 直接最大化品質，不走一般計算路徑
    qualityGain = recipe.quality - state.quality
    nextState.quality = recipe.quality
    nextState.innerQuiet = Math.min(MAX_INNER_QUIET, nextState.innerQuiet + 1)
    note = '職等遠超配方，直接最大化品質。'
  } else if ((action.qualityPotency ?? 0) > 0) {
    const baseQuality = getBaseQuality(stats, recipe)
    let potency = action.qualityPotency ?? 0

    if (action.id === 'byregotsBlessing') {
      potency += state.innerQuiet * 20
    }

    let multiplier = recipe.qualityModifier / 100
    if (state.buffs.innovation > 0) {
      multiplier *= 1.5
    }
    if (state.buffs.greatStrides > 0) {
      multiplier *= 2
    }

    multiplier *= 1 + state.innerQuiet * 0.1
    multiplier *= getConditionMultiplier(state.condition)

    qualityGain = Math.floor(baseQuality * (potency / 100) * multiplier)
    nextState.quality = clamp(nextState.quality + qualityGain, 0, recipe.quality)

    // Inner Quiet 堆疊
    if (action.id === 'reflect' || action.id === 'preparatoryTouch') {
      nextState.innerQuiet = Math.min(MAX_INNER_QUIET, nextState.innerQuiet + 2)
    } else if (action.id === 'preciseTouch') {
      nextState.innerQuiet = Math.min(MAX_INNER_QUIET, nextState.innerQuiet + 2)
    } else if (action.id === 'refinedTouch') {
      const bonus = state.lastActionId === 'basicTouch' ? 2 : 1
      nextState.innerQuiet = Math.min(MAX_INNER_QUIET, nextState.innerQuiet + bonus)
      if (bonus === 2) {
        note = note ? `${note} Refined Touch 連段加成，+2 IQ。` : 'Refined Touch 連段加成，+2 IQ。'
      }
    } else if (action.id === 'byregotsBlessing') {
      nextState.innerQuiet = 0
    } else if (action.id !== 'trainedFinesse') {
      nextState.innerQuiet = Math.min(MAX_INNER_QUIET, nextState.innerQuiet + 1)
    }

    if (state.buffs.greatStrides > 0 && action.kind === 'touch') {
      nextState.buffs.greatStrides = 0
    }
  }

  // ── Manipulation 每步恢復耐久 ─────────────────────────────────────────
  if (state.buffs.manipulation > 0 && action.id !== 'manipulation') {
    nextState.durability = Math.min(recipe.durability, nextState.durability + 5)
  }

  // ── Buff 倒計時 ───────────────────────────────────────────────────────
  nextState.buffs = decrementBuffs(nextState.buffs)
  nextState.condition = getNextCondition(state.condition, nextState.step, options.conditionMode ?? 'normal')

  // ── 結束判定 ──────────────────────────────────────────────────────────
  if (nextState.progress >= recipe.difficulty) {
    nextState.status = 'completed'
  } else if (nextState.durability <= 0) {
    nextState.status = 'broken'
    note = note ? `${note} 耐久歸零，製作失敗。` : '耐久歸零，製作失敗。'
  }

  return {
    actionId: action.id,
    actionLabel: action.label,
    isValid: true,
    note,
    progressGain,
    qualityGain,
    durabilityChange: nextState.durability - state.durability,
    cpChange: nextState.cp - state.cp,
    condition: state.condition,
    resultingState: nextState,
  }
}

export function simulateCraft(
  stats: CraftStats,
  recipe: CraftRecipe,
  sequence: CraftActionId[],
  options: CraftSimulationOptions = {},
): CraftSimulationResult {
  const initialState = createInitialState(stats, recipe)
  const steps: CraftSimulationStep[] = []
  let currentState = initialState

  for (const actionId of sequence) {
    const step = simulateAction(stats, recipe, currentState, actionId, options)
    steps.push(step)
    currentState = step.resultingState
  }

  const finalState = currentState
  const completionPercent = recipe.difficulty === 0 ? 100 : Math.min(100, Math.round((finalState.progress / recipe.difficulty) * 100))
  const qualityPercent = recipe.quality === 0 ? 0 : Math.min(100, Math.round((finalState.quality / recipe.quality) * 100))
  const hqPercent = recipe.canHq === false ? 0 : calcHqPercent(qualityPercent)

  return {
    initialState,
    steps,
    finalState,
    completionPercent,
    qualityPercent,
    hqPercent,
  }
}

function createStateBucketKey(state: CraftState): string {
  return [
    state.status,
    Math.floor(state.progress / 250),
    Math.floor(state.quality / 400),
    Math.floor(state.cp / 16),
    Math.floor(state.durability / 5),
    state.innerQuiet,
    state.buffs.veneration > 0 ? 1 : 0,
    state.buffs.innovation > 0 ? 1 : 0,
    state.buffs.greatStrides > 0 ? 1 : 0,
    state.buffs.wasteNot > 0 ? 1 : 0,
    state.buffs.manipulation > 0 ? 1 : 0,
    state.buffs.muscleMemory > 0 ? 1 : 0,
    state.buffs.finalAppraisal > 0 ? 1 : 0,
    state.buffs.heartAndSoul > 0 ? 1 : 0,
    state.buffs.trainedPerfectionReady ? 1 : 0,
    state.condition,
  ].join('|')
}

function scoreState(
  state: CraftState,
  recipe: CraftRecipe,
  objective: CraftSolverObjective,
  stepCount: number,
): number {
  if (state.status === 'broken') {
    return -1_000_000
  }

  const completionRatio = recipe.difficulty === 0 ? 1 : state.progress / recipe.difficulty
  const qualityRatio = recipe.quality === 0 ? 0 : state.quality / recipe.quality

  const progressWeight = objective === 'quality' ? 420 : objective === 'completion' ? 540 : 480
  const qualityWeight = objective === 'quality' ? 680 : objective === 'completion' ? 240 : 420
  const resourceBonus = state.cp * 1.4 + state.durability * 4 + state.innerQuiet * 18
  const stepPenalty = stepCount * 9

  if (state.status === 'completed') {
    return 2_000_000 + qualityRatio * qualityWeight * 100 + resourceBonus - stepPenalty
  }

  return completionRatio * progressWeight * 100 + qualityRatio * qualityWeight * 100 + resourceBonus - stepPenalty
}

function getCandidateActions(state: CraftState, objective: CraftSolverObjective): CraftActionId[] {
  const ordered = [...solverActionPriority]

  if (objective === 'quality' && state.progress > 0) {
    return ordered.filter((actionId) => actionId !== 'basicSynthesis')
  }

  return ordered
}

export function solveCraftSequence(
  stats: CraftStats,
  recipe: CraftRecipe,
  options: CraftSolverOptions = {},
): CraftSolverResult | null {
  const objective = options.objective ?? 'balanced'
  const conditionMode = options.conditionMode ?? 'normal'
  const maxSteps = clamp(options.maxSteps ?? 24, 6, 40)
  const beamWidth = clamp(options.beamWidth ?? 48, 12, 120)

  type Node = {
    sequence: CraftActionId[]
    state: CraftState
    score: number
  }

  const initialState = createInitialState(stats, recipe)
  let frontier: Node[] = [{ sequence: [], state: initialState, score: scoreState(initialState, recipe, objective, 0) }]
  let bestCompleted: Node | null = null
  let exploredStates = 0

  for (let depth = 0; depth < maxSteps; depth += 1) {
    const buckets = new Map<string, Node>()

    for (const node of frontier) {
      for (const actionId of getCandidateActions(node.state, objective)) {
        const step = simulateAction(stats, recipe, node.state, actionId, { conditionMode })
        exploredStates += 1

        if (!step.isValid) {
          continue
        }

        const nextNode: Node = {
          sequence: [...node.sequence, actionId],
          state: step.resultingState,
          score: scoreState(step.resultingState, recipe, objective, node.sequence.length + 1),
        }

        if (step.resultingState.status === 'completed') {
          if (!bestCompleted || nextNode.score > bestCompleted.score) {
            bestCompleted = nextNode
          }
          continue
        }

        if (step.resultingState.status === 'broken') {
          continue
        }

        const bucketKey = createStateBucketKey(step.resultingState)
        const existing = buckets.get(bucketKey)
        if (!existing || nextNode.score > existing.score) {
          buckets.set(bucketKey, nextNode)
        }
      }
    }

    if (buckets.size === 0) {
      break
    }

    frontier = [...buckets.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, beamWidth)
  }

  const chosen = bestCompleted ?? frontier[0] ?? null
  if (!chosen) {
    return null
  }

  const simulation = simulateCraft(stats, recipe, chosen.sequence, { conditionMode })

  return {
    sequence: chosen.sequence,
    simulation,
    objective,
    exploredStates,
    notes: [
      conditionMode === 'favorable'
        ? '條件模式使用 Favorable 假設，會定期插入 Good / Excellent 視窗。'
        : '條件模式使用 Normal 假設，所有步驟都視為一般條件。',
      bestCompleted
        ? 'Solver 已找到可完成配方的序列。'
        : 'Solver 未找到完工序列，以下顯示目前分數最高的候選。',
    ],
  }
}

/** 繁中伺服器 FFXIV 客戶端技能指令名稱（巨集使用）*/
const macroNameZhTW: Record<CraftActionId, string> = {
  reflect: '閒靜',
  muscleMemory: '堅信',
  veneration: '崇敬',
  basicSynthesis: '製作',
  carefulSynthesis: '模範製作',
  groundwork: '坯料製作',
  prudentSynthesis: '儉約製作',
  delicateSynthesis: '精密製作',
  focusedSynthesis: '專心製作',
  intensiveSynthesis: '集中製作',
  innovation: '改革',
  greatStrides: '闊步',
  basicTouch: '加工',
  standardTouch: '中級加工',
  advancedTouch: '上級加工',
  prudentTouch: '儉約加工',
  preparatoryTouch: '坯料加工',
  focusedTouch: '專心加工',
  preciseTouch: '集中加工',
  byregotsBlessing: '比爾格的祝福',
  trainedFinesse: '工匠的神技',
  wasteNot: '儉約',
  wasteNotII: '長期儉約',
  manipulation: '掌握',
  mastersMend: '精修',
  observe: '觀察',
  tricksOfTheTrade: '秘訣',
  refinedTouch: '精煉加工',
  finalAppraisal: '最終確認',
  trainedEye: '工匠的神速技巧',
  heartAndSoul: '專心致志',
  immaculateMend: '巧奪天工',
  trainedPerfection: '工匠的絕技',
  quickInnovation: '快速改革',
  rapidSynthesis: '高速製作',
  hastyTouch: '倉促',
  // 冒進在巨集中以倉促觸發（與 BestCraft 一致）
  daringTouch: '倉促',
}

function getMacroWait(actionId: CraftActionId): number {
  // HeartAndSoul / QuickInnovation 雖是 buff 類但動作時間為 2.17s → wait.3
  if (actionId === 'heartAndSoul' || actionId === 'quickInnovation') return 3
  return getActionById(actionId).kind === 'buff' ? 2 : 3
}

export function buildMacroChunks(sequence: CraftActionId[]): string[][] {
  if (sequence.length === 0) return []
  // 每段最多 14 個動作行 + 1 完成通知行 = 15 行（與 BestCraft 一致）
  const ACTIONS_PER_CHUNK = 14
  const chunks: string[][] = []
  const totalChunks = Math.ceil(sequence.length / ACTIONS_PER_CHUNK)

  for (let i = 0; i < totalChunks; i++) {
    const slice = sequence.slice(i * ACTIONS_PER_CHUNK, (i + 1) * ACTIONS_PER_CHUNK)
    const lines = slice.map((actionId) => `/ac ${macroNameZhTW[actionId]} <wait.${getMacroWait(actionId)}>`)
    lines.push(`/e 巨集 #${i + 1} 已完成！<se.1>`)
    chunks.push(lines)
  }

  return chunks
}

export function parseMacroText(rawValue: string): CraftActionId[] {
  const matches = rawValue
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const quoted = line.match(/"([^"]+)"/u)?.[1]
      return quoted ?? line.replace(/^\/ac\s+/u, '').replace(/\s*<wait\.\d+>/u, '').trim()
    })

  const nameMap = new Map<string, CraftActionId>()
  for (const action of craftActionDefinitions) {
    nameMap.set(action.label, action.id)
    nameMap.set(action.macroName, action.id)
    nameMap.set(action.id, action.id)
    // 僅在名稱未被先前條目佔用時才設定（避免 daringTouch 覆蓋 hastyTouch 的共用名「倉促」）
    const zhName = macroNameZhTW[action.id]
    if (!nameMap.has(zhName)) nameMap.set(zhName, action.id)
  }

  return matches
    .map((entry) => nameMap.get(entry))
    .filter((entry): entry is CraftActionId => Boolean(entry))
}

export function createDefaultCraftStats(): CraftStats {
  return {
    level: 100,
    craftsmanship: 4780,
    control: 4500,
    cp: 560,
    specialist: false,
  }
}

export function createDefaultCraftRecipe(): CraftRecipe {
  return { ...craftRecipePresets[0].recipe }
}
