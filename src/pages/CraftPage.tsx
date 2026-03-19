import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchRecipeDetails, searchRecipeResults, searchXivapi, type XivapiRecipeSearchResult, type XivapiSearchResult } from '../api/xivapi'
import { pageSources } from '../catalog/sources'
import { collectionEntries } from '../collection/data'
import SourceAttribution from '../components/SourceAttribution'
import {
  buildMacroChunks,
  craftActionDefinitions,
  craftRecipePresets,
  createDefaultCraftRecipe,
  createDefaultCraftStats,
  parseMacroText,
  simulateCraft,
  solveCraftSequence,
  type CraftActionDefinition,
  type CraftActionId,
  type CraftCondition,
  type CraftConditionMode,
  type CraftRecipe,
  type CraftSolverObjective,
  type CraftStats,
} from '../craft/simulator'
import { getErrorMessage } from '../utils/errors'

const STORAGE_KEY = 'ff14-helper.craft.workbench.v3'

type CraftTab = 'recipe' | 'sequence' | 'result' | 'tasks'
type TaskFilter = 'all' | 'custom' | 'tribe-craft' | 'tribe-gather'
type ActionPaletteFilter = 'all' | 'progress' | 'quality' | 'support'
type CraftJobId = 'carpenter' | 'blacksmith' | 'armorer' | 'goldsmith' | 'leatherworker' | 'weaver' | 'alchemist' | 'culinarian'

type CraftJobProfiles = Record<CraftJobId, CraftStats>

interface SavedCraftState {
  stats: CraftStats
  currentJob: CraftJobId
  jobProfiles: CraftJobProfiles
  recipe: CraftRecipe
  sequence: CraftActionId[]
  importText: string
  conditionMode: CraftConditionMode
  solverObjective: CraftSolverObjective
  taskFilter: TaskFilter
}

const localizedActionNames: Record<CraftActionId, string> = {
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
  daringTouch: '冒進',
}

const presetCopy: Record<string, { label: string; note: string }> = {
  'dt-100-hard': {
    label: '7.x 100 等高難度範例',
    note: '適合拿來測試 solver 與高難度耐久配方。',
  },
  'collectable-70': {
    label: '收藏品 70 耐久範例',
    note: '適合模擬老主顧與收藏品類型的收尾節奏。',
  },
  'quick-40': {
    label: '40 耐久速製範例',
    note: '適合快速測試短 rotation 與簡化手法。',
  },
}

const craftJobOptions: Array<{ id: CraftJobId; label: string; apiName: string }> = [
  { id: 'carpenter', label: '刻木匠', apiName: 'Carpenter' },
  { id: 'blacksmith', label: '鍛鐵匠', apiName: 'Blacksmith' },
  { id: 'armorer', label: '鑄甲匠', apiName: 'Armorer' },
  { id: 'goldsmith', label: '雕金匠', apiName: 'Goldsmith' },
  { id: 'leatherworker', label: '製革匠', apiName: 'Leatherworker' },
  { id: 'weaver', label: '裁衣匠', apiName: 'Weaver' },
  { id: 'alchemist', label: '鍊金術士', apiName: 'Alchemist' },
  { id: 'culinarian', label: '烹調師', apiName: 'Culinarian' },
]

function createDefaultJobProfiles(): CraftJobProfiles {
  const base = createDefaultCraftStats()
  return {
    carpenter: { ...base },
    blacksmith: { ...base },
    armorer: { ...base },
    goldsmith: { ...base },
    leatherworker: { ...base },
    weaver: { ...base },
    alchemist: { ...base },
    culinarian: { ...base },
  }
}

function mapCraftTypeNameToJobId(value?: string): CraftJobId | null {
  if (!value) return null
  const normalized = value.trim().toLocaleLowerCase('en-US')
  return craftJobOptions.find((job) => job.apiName.toLocaleLowerCase('en-US') === normalized || job.id === normalized)?.id ?? null
}

function formatJobLabel(jobId: CraftJobId): string {
  return craftJobOptions.find((job) => job.id === jobId)?.label ?? jobId
}

function formatRecipeJobName(jobName?: string): string {
  const mappedJob = mapCraftTypeNameToJobId(jobName)
  return mappedJob ? formatJobLabel(mappedJob) : (jobName ?? '未指定')
}

function loadSavedState(): SavedCraftState {
  const defaultProfiles = createDefaultJobProfiles()
  const fallback: SavedCraftState = {
    stats: createDefaultCraftStats(),
    currentJob: 'culinarian',
    jobProfiles: defaultProfiles,
    recipe: { ...createDefaultCraftRecipe(), source: '預設範例' },
    sequence: [],
    importText: '',
    conditionMode: 'normal',
    solverObjective: 'balanced',
    taskFilter: 'all',
  }

  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<SavedCraftState>
    const nextCurrentJob = parsed.currentJob ?? fallback.currentJob
    const nextProfiles = { ...defaultProfiles, ...(parsed.jobProfiles ?? {}) }
    return {
      ...fallback,
      ...parsed,
      currentJob: nextCurrentJob,
      jobProfiles: nextProfiles,
      stats: nextProfiles[nextCurrentJob] ?? parsed.stats ?? fallback.stats,
    }
  } catch {
    return fallback
  }
}

function groupActions(isSpecialist: boolean): Array<{ id: ActionPaletteFilter; title: string; description: string; items: CraftActionDefinition[] }> {
  const specialistIds: CraftActionId[] = ['heartAndSoul', 'immaculateMend', 'trainedPerfection', 'quickInnovation']
  return [
    {
      id: 'progress',
      title: '開場與進度',
      description: '先推進製作進度，適合擺在 rotation 前段。',
      items: craftActionDefinitions.filter((action) =>
        (['reflect', 'muscleMemory', 'trainedEye', 'veneration', 'basicSynthesis', 'carefulSynthesis', 'groundwork', 'prudentSynthesis', 'focusedSynthesis', 'intensiveSynthesis', 'delicateSynthesis', 'rapidSynthesis'] as CraftActionId[]).includes(action.id),
      ),
    },
    {
      id: 'quality',
      title: '品質與收尾',
      description: '提高品質、堆疊內靜與做最終收尾。',
      items: craftActionDefinitions.filter((action) =>
        (['innovation', 'greatStrides', 'basicTouch', 'standardTouch', 'advancedTouch', 'refinedTouch', 'prudentTouch', 'preparatoryTouch', 'focusedTouch', 'preciseTouch', 'trainedFinesse', 'byregotsBlessing', 'hastyTouch', 'daringTouch'] as CraftActionId[]).includes(action.id),
      ),
    },
    {
      id: 'support',
      title: '耐久與輔助',
      description: '用來保耐久、開狀態或準備 Focused 技能。',
      items: craftActionDefinitions.filter((action) =>
        (['finalAppraisal', 'wasteNot', 'wasteNotII', 'manipulation', 'mastersMend', 'tricksOfTheTrade', 'observe'] as CraftActionId[]).includes(action.id),
      ),
    },
    ...(isSpecialist
      ? [
          {
            id: 'support' as ActionPaletteFilter,
            title: '專家職業技能（Specialist）',
            description: '需要持有 專家圖紙 才能解鎖，每次製作有使用次數限制。',
            items: craftActionDefinitions.filter((action) => specialistIds.includes(action.id as CraftActionId)),
          },
        ]
      : []),
  ]
}

function formatSupportRole(role: string): string {
  switch (role) {
    case 'crafting': return '製作'
    case 'gathering': return '採集'
    case 'fishing': return '釣魚'
    case 'combat': return '戰鬥'
    default: return role
  }
}

function formatConditionMode(mode: CraftConditionMode): string {
  return mode === 'favorable' ? '優良條件循環' : '一般條件循環'
}

function formatConditionLabel(condition: CraftCondition): string {
  switch (condition) {
    case 'good': return '高品質'
    case 'excellent': return '最高品質'
    case 'poor': return '低品質'
    case 'centered': return '安定'
    case 'sturdy': return '結実'
    case 'pliant': return '柔軟'
    case 'malleable': return '強固'
    case 'primed': return '備蓄'
    case 'goodOmen': return '前兆'
    case 'robust': return '堅固'
    default: return '一般'
  }
}

function formatStatus(status: 'running' | 'completed' | 'broken'): string {
  if (status === 'completed') return '已完工'
  if (status === 'broken') return '失敗'
  return '進行中'
}

function formatRecipeSource(source?: string): string {
  if (!source) return '自訂配方'
  if (source === 'XIVAPI Recipe') return 'XIVAPI 配方'
  return source
}

const TABS: Array<{ id: CraftTab; label: string }> = [
  { id: 'recipe', label: '帶入配方' },
  { id: 'sequence', label: '技能序列' },
  { id: 'result', label: '模擬結果' },
  { id: 'tasks', label: '相關任務' },
]

function CraftPage() {
  const [savedState] = useState(() => loadSavedState())
  const [stats, setStats] = useState<CraftStats>(savedState.stats)
  const [currentJob, setCurrentJob] = useState<CraftJobId>(savedState.currentJob)
  const [jobProfiles, setJobProfiles] = useState<CraftJobProfiles>(savedState.jobProfiles)
  const [recipe, setRecipe] = useState<CraftRecipe>(savedState.recipe)
  const [sequence, setSequence] = useState<CraftActionId[]>(savedState.sequence)
  const [importText, setImportText] = useState(savedState.importText)
  const [conditionMode, setConditionMode] = useState<CraftConditionMode>(savedState.conditionMode)
  const [solverObjective, setSolverObjective] = useState<CraftSolverObjective>(savedState.solverObjective)
  const [taskFilter, setTaskFilter] = useState<TaskFilter>(savedState.taskFilter)
  const [taskSearchQuery, setTaskSearchQuery] = useState('')
  const [actionQuery, setActionQuery] = useState('')
  const [paletteFilter, setPaletteFilter] = useState<ActionPaletteFilter>('all')
  const [message, setMessage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [recipeResults, setRecipeResults] = useState<XivapiRecipeSearchResult[]>([])
  const [itemResults, setItemResults] = useState<XivapiSearchResult[]>([])
  const [selectedRecipeRowId, setSelectedRecipeRowId] = useState<number | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [solverLoading, setSolverLoading] = useState(false)
  const [solverNotes, setSolverNotes] = useState<string[]>([])
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<CraftTab>('recipe')
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ stats, currentJob, jobProfiles, recipe, sequence, importText, conditionMode, solverObjective, taskFilter } satisfies SavedCraftState),
      )
    }
  }, [conditionMode, currentJob, importText, jobProfiles, recipe, sequence, solverObjective, stats, taskFilter])

  useEffect(() => {
    setStats(jobProfiles[currentJob])
  }, [currentJob, jobProfiles])

  const simulation = useMemo(() => simulateCraft(stats, recipe, sequence, { conditionMode }), [conditionMode, recipe, sequence, stats])
  const actionGroups = useMemo(() => groupActions(stats.specialist ?? false), [stats.specialist])
  const filteredActionGroups = useMemo(
    () =>
      actionGroups
        .filter((group) => paletteFilter === 'all' || group.id === paletteFilter)
        .map((group) => ({
          ...group,
          items: group.items.filter((action) => {
            const keyword = actionQuery.trim().toLocaleLowerCase('en-US')
            if (!keyword) return true
            return [localizedActionNames[action.id], action.label, action.description]
              .join(' ')
              .toLocaleLowerCase('en-US')
              .includes(keyword)
          }),
        }))
        .filter((group) => group.items.length > 0),
    [actionGroups, actionQuery, paletteFilter],
  )
  const macroChunks = useMemo(() => buildMacroChunks(sequence), [sequence])
  const sequenceCpEstimate = useMemo(
    () => sequence.reduce((total, actionId) => total + (craftActionDefinitions.find((entry) => entry.id === actionId)?.cpCost ?? 0), 0),
    [sequence],
  )
  const sequenceSuggestions = useMemo(() => {
    if (sequence.length === 0) return ['reflect', 'muscleMemory', 'veneration'] as CraftActionId[]
    if (simulation.completionPercent < 60) return ['veneration', 'groundwork', 'carefulSynthesis'] as CraftActionId[]
    if (simulation.qualityPercent < 80) return ['innovation', 'greatStrides', 'basicTouch'] as CraftActionId[]
    return ['byregotsBlessing', 'carefulSynthesis', 'mastersMend'] as CraftActionId[]
  }, [sequence.length, simulation.completionPercent, simulation.qualityPercent])
  const recipeJobId = useMemo(() => mapCraftTypeNameToJobId(recipe.jobName), [recipe.jobName])
  const recipeJobMismatch = recipeJobId ? recipeJobId !== currentJob : false
  const relevantTasks = useMemo(() => {
    const keyword = taskSearchQuery.trim().toLocaleLowerCase('zh-TW')
    return collectionEntries.filter((entry) => {
      const categoryMatch = (() => {
        switch (taskFilter) {
          case 'custom': return entry.category === 'custom-deliveries'
          case 'tribe-craft': return entry.category === 'allied-societies' && entry.supportRoles.includes('crafting')
          case 'tribe-gather': return entry.category === 'allied-societies' && entry.supportRoles.includes('gathering')
          default: return entry.category === 'custom-deliveries' || entry.supportRoles.includes('crafting') || entry.supportRoles.includes('gathering')
        }
      })()
      if (!categoryMatch) return false
      if (!keyword) return true
      return [entry.name, entry.location, entry.unlockSummary, ...entry.rewardSummary]
        .join(' ')
        .toLocaleLowerCase('zh-TW')
        .includes(keyword)
    })
  }, [taskFilter, taskSearchQuery])

  function updateStats<K extends keyof CraftStats>(key: K, value: CraftStats[K]): void {
    setStats((current) => {
      const next = { ...current, [key]: value }
      setJobProfiles((profiles) => ({ ...profiles, [currentJob]: next }))
      return next
    })
  }

  function updateRecipe<K extends keyof CraftRecipe>(key: K, value: CraftRecipe[K]): void {
    setRecipe((current) => ({ ...current, [key]: value }))
  }

  function addAction(actionId: CraftActionId): void {
    setSequence((current) => [...current, actionId])
    setMessage(`已加入動作：${localizedActionNames[actionId]}。`)
  }

  function removeLastAction(): void {
    setSequence((current) => current.slice(0, -1))
    setMessage('已移除最後一個動作。')
  }

  function applyPreset(presetId: string): void {
    const preset = craftRecipePresets.find((entry) => entry.id === presetId)
    if (!preset) return
    setRecipe({ ...preset.recipe, source: '預設範例' })
    setSelectedRecipeRowId(null)
    setMessage(`已套用範例配方：${presetCopy[presetId]?.label ?? preset.id}。`)
  }

  async function handleRecipeSearch(): Promise<void> {
    const term = searchQuery.trim()
    if (term.length < 2) {
      setMessage('請至少輸入 2 個字元再搜尋。')
      return
    }
    setSearchLoading(true)
    try {
      const [recipes, items] = await Promise.all([searchRecipeResults(term, 8), searchXivapi(term, 'Item', 8)])
      setRecipeResults(recipes)
      setItemResults(items)
      setMessage(`已找到 ${recipes.length} 筆配方結果與 ${items.length} 筆道具結果。`)
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setSearchLoading(false)
    }
  }

  async function applyRecipeFromRow(rowId: number): Promise<void> {
    try {
      const detail = await fetchRecipeDetails(rowId)
      const matchedJob = mapCraftTypeNameToJobId(detail.craftTypeName)
      setRecipe({
        name: detail.name,
        level: detail.classJobLevel,
        difficulty: detail.difficulty,
        quality: detail.quality,
        durability: detail.durability,
        progressDivider: detail.progressDivider,
        progressModifier: detail.progressModifier,
        qualityDivider: detail.qualityDivider,
        qualityModifier: detail.qualityModifier,
        initialQuality: 0,
        jobName: detail.craftTypeName,
        canHq: detail.canHq,
        yield: detail.amountResult,
        ingredients: detail.ingredients,
        source: 'XIVAPI Recipe',
      })
      if (matchedJob) setCurrentJob(matchedJob)
      setSelectedRecipeRowId(rowId)
      setMessage(`已帶入配方：${detail.name}。`)
    } catch (error) {
      setMessage(getErrorMessage(error))
    }
  }

  async function applyRecipeFromItem(item: XivapiSearchResult): Promise<void> {
    try {
      const candidates = await searchRecipeResults(item.name, 8)
      const matched = candidates.find((entry) => entry.name.toLocaleLowerCase('en-US') === item.name.toLocaleLowerCase('en-US')) ?? candidates[0]
      if (!matched) {
        setMessage(`找不到對應配方：${item.name}。`)
        return
      }
      await applyRecipeFromRow(matched.rowId)
    } catch (error) {
      setMessage(getErrorMessage(error))
    }
  }

  async function handleRunSolver(): Promise<void> {
    setSolverLoading(true)
    try {
      const result = solveCraftSequence(stats, recipe, {
        objective: solverObjective,
        conditionMode,
        maxSteps: 24,
        beamWidth: 56,
      })

      if (!result) {
        setSolverNotes(['目前找不到可用的候選序列。', '建議提高能力值、降低配方難度，或改用手動排動作。'])
        setMessage('Solver 沒有找到可用結果。')
        return
      }

      setSequence(result.sequence)
      setSolverNotes([
        conditionMode === 'favorable' ? '這次 solver 以優良條件循環作為估算前提。' : '這次 solver 以一般條件循環作為估算前提。',
        result.simulation.finalState.status === 'completed' ? '已找到可完工的候選序列。' : '目前找到的是最接近完工的候選序列。',
        `探索狀態數：${result.exploredStates.toLocaleString('zh-TW')}。`,
        `預估結果：${formatStatus(result.simulation.finalState.status)}，進度 ${result.simulation.completionPercent}% / 品質 ${result.simulation.qualityPercent}%。`,
      ])
      setMessage('已套用 solver 產生的序列。')
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setSolverLoading(false)
    }
  }

  function handleImportMacro(): void {
    const parsed = parseMacroText(importText)
    if (parsed.length === 0) {
      setMessage('沒有辨識到可用的 macro 動作。')
      return
    }
    setSequence(parsed)
    setMessage(`已從 macro 匯入 ${parsed.length} 個動作。`)
  }

  function handleTaskSearch(query: string): void {
    setSearchQuery(query)
    setActiveTab('recipe')
    window.setTimeout(() => {
      searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      searchInputRef.current?.focus()
    }, 50)
  }

  async function handleCopy(label: string, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedLabel(label)
      setMessage('已複製到剪貼簿。')
      window.setTimeout(() => setCopiedLabel((current) => (current === label ? null : current)), 1200)
    } catch (error) {
      setMessage(getErrorMessage(error))
    }
  }

  return (
    <div className="page-grid">
      {/* ── Hero ── */}
      <section className="hero-card">
        <p className="eyebrow">Craft Workbench</p>
        <h2>製作助手</h2>
        <p className="lead">
          先帶入配方與能力，再排技能或跑 solver，最後看模擬結果與 macro。
          技能名稱直接對照 BestCraft 的繁體中文語系，避免和常見中文用法脫節。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">使用 BestCraft 繁中技能名稱</span>
          <span className="badge">支援 XIVAPI 配方搜尋</span>
          <span className="badge badge--warning">Solver 為站內估算工具，結果請自行驗證</span>
        </div>
      </section>

      {/* ── Persistent status strip ── */}
      <section className="page-card">
        <div className="stats-grid">
          <article className="stat-card"><div className="stat-label">動作數</div><div className="stat-value">{sequence.length}</div></article>
          <article className="stat-card"><div className="stat-label">CP 粗估</div><div className="stat-value">{sequenceCpEstimate}</div></article>
          <article className="stat-card"><div className="stat-label">進度</div><div className="stat-value">{simulation.completionPercent}%</div></article>
          <article className="stat-card"><div className="stat-label">品質</div><div className="stat-value">{simulation.qualityPercent}%</div></article>
          <article className="stat-card"><div className="stat-label">HQ 估算</div><div className="stat-value">{simulation.hqPercent}%</div></article>
          <article className="stat-card"><div className="stat-label">狀態</div><div className="stat-value">{formatStatus(simulation.finalState.status)}</div></article>
        </div>
        <div className="button-row">
          <button className="button button--ghost" disabled={sequence.length === 0} onClick={removeLastAction} type="button">
            撤銷最後一步
          </button>
          <button className="button button--ghost" disabled={sequence.length === 0} onClick={() => setSequence([])} type="button">
            清空序列
          </button>
          <button className="button button--ghost" onClick={() => setActiveTab('result')} type="button">
            檢視模擬結果
          </button>
        </div>
        <div className="sequence-chip-list">
          {sequence.length === 0 ? (
            <span className="muted">目前還沒有任何動作。</span>
          ) : (
            sequence.map((actionId, index) => (
              <span key={`${actionId}-${index}`} className="sequence-chip">
                {index + 1}. {localizedActionNames[actionId]}
              </span>
            ))
          )}
        </div>
      </section>

      {/* ── Tabbed workspace ── */}
      <section>
        <div className="tool-tab-bar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'tool-tab tool-tab--active' : 'tool-tab'}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: 帶入配方 */}
        {activeTab === 'recipe' && (
          <div className="tool-panel source-grid">
            <article className="page-card">
              <div className="section-heading">
                <h2>職業與能力值</h2>
                <p>先選目前正在製作的職業，再設定這個職業自己的能力值。不同職業會各自保存一套數值。</p>
              </div>
              <div className="field-grid">
                <label className="field">
                  <span className="field-label">目前職業</span>
                  <select className="input-select" onChange={(event) => setCurrentJob(event.target.value as CraftJobId)} value={currentJob}>
                    {craftJobOptions.map((job) => (
                      <option key={job.id} value={job.id}>{job.label}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">搜尋配方或道具</span>
                  <input
                    className="input-text"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') void handleRecipeSearch() }}
                    placeholder="例如 Bronze Ingot / Tacos / Potion"
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                  />
                </label>
                <label className="field"><span className="field-label">Crafter Level</span><input className="input-text" min="1" onChange={(event) => updateStats('level', Number(event.target.value))} type="number" value={stats.level} /></label>
                <label className="field"><span className="field-label">Craftsmanship</span><input className="input-text" min="1" onChange={(event) => updateStats('craftsmanship', Number(event.target.value))} type="number" value={stats.craftsmanship} /></label>
                <label className="field"><span className="field-label">Control</span><input className="input-text" min="1" onChange={(event) => updateStats('control', Number(event.target.value))} type="number" value={stats.control} /></label>
                <label className="field"><span className="field-label">CP</span><input className="input-text" min="1" onChange={(event) => updateStats('cp', Number(event.target.value))} type="number" value={stats.cp} /></label>
                <label className="field" style={{ gridColumn: 'span 2' }}>
                  <span className="field-label">Specialist（持有專家圖紙）</span>
                  <div className="choice-row">
                    <button
                      className={stats.specialist ? 'choice-button choice-button--active' : 'choice-button'}
                      onClick={() => updateStats('specialist', true)}
                      type="button"
                    >
                      是
                    </button>
                    <button
                      className={!stats.specialist ? 'choice-button choice-button--active' : 'choice-button'}
                      onClick={() => updateStats('specialist', false)}
                      type="button"
                    >
                      否
                    </button>
                  </div>
                </label>
              </div>
              {stats.specialist ? (
                <div className="callout">
                  <span className="callout-title">Specialist 模式已開啟</span>
                  <span className="callout-body">
                    技能面板中會顯示「專家職業技能」分組，包含專心致志、巧奪天工、工匠的絕技、快速改革。
                  </span>
                </div>
              ) : null}
              {stats.level >= recipe.level + 10 ? (
                <div className="callout">
                  <span className="callout-title">可使用工匠的神速技巧</span>
                  <span className="callout-body">
                    你的職等（{stats.level}）比配方等級（{recipe.level}）高出 {stats.level - recipe.level} 級，可於第一手直接最大化品質。
                  </span>
                </div>
              ) : null}
              <div className="callout">
                <span className="callout-title">目前職業能力值</span>
                <span className="callout-body">
                  {formatJobLabel(currentJob)}：Lv.{stats.level} / Craftsmanship {stats.craftsmanship} / Control {stats.control} / CP {stats.cp}{stats.specialist ? ' / Specialist' : ''}
                </span>
              </div>
              <div className="sequence-chip-list">
                {craftJobOptions.map((job) => (
                  <span key={job.id} className={job.id === currentJob ? 'sequence-chip sequence-chip--active' : 'sequence-chip'}>
                    {job.label} {jobProfiles[job.id].craftsmanship}/{jobProfiles[job.id].control}/{jobProfiles[job.id].cp}
                  </span>
                ))}
              </div>
              <div className="button-row">
                <button className="button button--primary" disabled={searchLoading} onClick={() => void handleRecipeSearch()} type="button">
                  {searchLoading ? '搜尋中...' : '搜尋配方'}
                </button>
                {craftRecipePresets.map((preset) => (
                  <button key={preset.id} className="button button--ghost" onClick={() => applyPreset(preset.id)} type="button">
                    {presetCopy[preset.id]?.label ?? preset.id}
                  </button>
                ))}
              </div>
              <div className="history-list">
                {recipeResults.slice(0, 4).map((result) => (
                  <article key={result.rowId} className="history-item">
                    <div className="history-item__top">
                      <strong>{result.name}</strong>
                      <span className={selectedRecipeRowId === result.rowId ? 'badge badge--positive' : 'badge'}>
                        {formatRecipeJobName(result.craftTypeName)}
                      </span>
                    </div>
                    <div className="button-row">
                      <button className="button button--ghost" onClick={() => void applyRecipeFromRow(result.rowId)} type="button">
                        帶入配方
                      </button>
                    </div>
                  </article>
                ))}
                {itemResults.slice(0, 3).map((item) => (
                  <article key={`item-${item.rowId}`} className="history-item">
                    <div className="history-item__top">
                      <strong>{item.name}</strong>
                      <span className="badge">Item</span>
                    </div>
                    <div className="button-row">
                      <button className="button button--ghost" onClick={() => void applyRecipeFromItem(item)} type="button">
                        嘗試找配方
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <article className="page-card">
              <div className="section-heading">
                <h2>目前配方</h2>
                <p>這裡是工作台的核心參數。若 API 沒帶到完整資料，也可以手動微調。</p>
              </div>
              <div className="field-grid">
                <label className="field"><span className="field-label">配方名稱</span><input className="input-text" onChange={(event) => updateRecipe('name', event.target.value)} type="text" value={recipe.name} /></label>
                <label className="field">
                  <span className="field-label">配方職業</span>
                  <select
                    className="input-select"
                    onChange={(event) =>
                      updateRecipe(
                        'jobName',
                        craftJobOptions.find((job) => job.id === event.target.value)?.apiName ?? undefined,
                      )
                    }
                    value={mapCraftTypeNameToJobId(recipe.jobName) ?? ''}
                  >
                    <option value="">未指定</option>
                    {craftJobOptions.map((job) => (
                      <option key={job.id} value={job.id}>{job.label}</option>
                    ))}
                  </select>
                </label>
                <label className="field"><span className="field-label">配方等級</span><input className="input-text" min="1" onChange={(event) => updateRecipe('level', Number(event.target.value))} type="number" value={recipe.level} /></label>
                <label className="field"><span className="field-label">Difficulty</span><input className="input-text" min="1" onChange={(event) => updateRecipe('difficulty', Number(event.target.value))} type="number" value={recipe.difficulty} /></label>
                <label className="field"><span className="field-label">Quality</span><input className="input-text" min="0" onChange={(event) => updateRecipe('quality', Number(event.target.value))} type="number" value={recipe.quality} /></label>
                <label className="field"><span className="field-label">Durability</span><input className="input-text" min="1" onChange={(event) => updateRecipe('durability', Number(event.target.value))} type="number" value={recipe.durability} /></label>
                <label className="field"><span className="field-label">初始品質</span><input className="input-text" min="0" onChange={(event) => updateRecipe('initialQuality', Number(event.target.value))} type="number" value={recipe.initialQuality} /></label>
              </div>
              <div className="badge-row">
                <span className="badge">來源：{formatRecipeSource(recipe.source)}</span>
                <span className="badge">配方職業：{formatRecipeJobName(recipe.jobName)}</span>
                <span className="badge">目前職業：{formatJobLabel(currentJob)}</span>
                <span className="badge">{recipe.canHq === false ? '不可 HQ' : '可 HQ'}</span>
                {recipe.yield ? <span className="badge">產出數量：{recipe.yield}</span> : null}
              </div>
              {recipeJobMismatch ? (
                <div className="callout callout--error">
                  <span className="callout-title">職業不一致</span>
                  <span className="callout-body">
                    這張配方屬於 {formatRecipeJobName(recipe.jobName)}，但你目前選的是 {formatJobLabel(currentJob)}。如要模擬正確數值，請切回對應職業。
                  </span>
                </div>
              ) : null}
              {recipe.ingredients && recipe.ingredients.length > 0 ? (
                <div className="history-list">
                  {recipe.ingredients.map((ingredient) => (
                    <article key={`${ingredient.name}-${ingredient.amount}`} className="history-item">
                      <div className="history-item__top">
                        <strong>{ingredient.name}</strong>
                        <span className="badge">x{ingredient.amount}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>目前沒有材料明細</strong>
                  <p>如果是自訂配方或範例配方，沒有材料明細是正常的。</p>
                </div>
              )}
              <div className="history-list">
                {craftRecipePresets.map((preset) => (
                  <article key={`${preset.id}-note`} className="history-item">
                    <div className="history-item__top">
                      <strong>{presetCopy[preset.id]?.label ?? preset.id}</strong>
                      <span className="badge">範例</span>
                    </div>
                    <p className="muted">{presetCopy[preset.id]?.note ?? '站內範例配方。'}</p>
                  </article>
                ))}
              </div>
            </article>
          </div>
        )}

        {/* Tab: 技能序列 */}
        {activeTab === 'sequence' && (
          <div className="tool-panel source-grid">
            <article className="page-card">
              <div className="section-heading">
                <h2>技能面板</h2>
                <p>點擊技能加入序列；可用下方篩選縮小範圍。</p>
              </div>
              <div className="field-grid">
                <label className="field">
                  <span className="field-label">搜尋技能</span>
                  <input className="input-text" onChange={(event) => setActionQuery(event.target.value)} placeholder="可搜中文名、英文名或描述" type="text" value={actionQuery} />
                </label>
                <label className="field">
                  <span className="field-label">技能分組</span>
                  <select className="input-select" onChange={(event) => setPaletteFilter(event.target.value as ActionPaletteFilter)} value={paletteFilter}>
                    <option value="all">全部技能</option>
                    <option value="progress">開場與進度</option>
                    <option value="quality">品質與收尾</option>
                    <option value="support">耐久與輔助</option>
                  </select>
                </label>
              </div>
              <div className="callout">
                <span className="callout-title">下一手建議</span>
                <div className="badge-row">
                  {sequenceSuggestions.map((actionId) => (
                    <button key={actionId} className="button button--ghost" onClick={() => addAction(actionId)} type="button">
                      加入 {localizedActionNames[actionId]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="history-list">
                {filteredActionGroups.map((group) => (
                  <article key={group.id} className="list-panel">
                    <p className="callout-title">{group.title}</p>
                    <p className="muted">{group.description}</p>
                    <div className="choice-row">
                      {group.items.map((action) => (
                        <button key={action.id} className="choice-button" onClick={() => addAction(action.id)} type="button">
                          <strong>{localizedActionNames[action.id]}</strong>
                          <p className="muted">{action.label} | CP {action.cpCost} | 耐久 {action.durabilityCost}</p>
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <article className="page-card">
              <div className="section-heading">
                <h2>序列編輯與 Solver</h2>
                <p>手動排完後可以直接跑 solver，比較目前序列與自動候選之間的差距；也可以貼上既有 macro 匯入。</p>
              </div>
              <div className="field-grid">
                <label className="field">
                  <span className="field-label">條件模式</span>
                  <select className="input-select" onChange={(event) => setConditionMode(event.target.value as CraftConditionMode)} value={conditionMode}>
                    <option value="normal">一般條件</option>
                    <option value="favorable">優良條件循環</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Solver 目標</span>
                  <select className="input-select" onChange={(event) => setSolverObjective(event.target.value as CraftSolverObjective)} value={solverObjective}>
                    <option value="balanced">平衡</option>
                    <option value="quality">品質優先</option>
                    <option value="completion">完工優先</option>
                  </select>
                </label>
              </div>
              <div className="button-row">
                <button className="button button--primary" disabled={solverLoading} onClick={() => void handleRunSolver()} type="button">
                  {solverLoading ? '計算中...' : '執行 Solver'}
                </button>
                <button className="button button--ghost" onClick={() => setSequence([])} type="button">
                  清空序列
                </button>
              </div>
              {solverNotes.length > 0 ? (
                <div className="callout">
                  <span className="callout-title">Solver 摘要</span>
                  <div className="detail-list">{solverNotes.map((note) => <span key={note}>{note}</span>)}</div>
                </div>
              ) : null}
              <label className="field">
                <span className="field-label">匯入 Macro 文字</span>
                <textarea className="input-text" onChange={(event) => setImportText(event.target.value)} rows={5} value={importText} />
              </label>
              <div className="button-row">
                <button className="button button--ghost" onClick={handleImportMacro} type="button">從文字匯入 Macro</button>
                <button className="button button--ghost" onClick={() => setImportText('')} type="button">清空匯入區</button>
              </div>
              {sequence.length === 0 ? (
                <div className="empty-state">
                  <strong>目前還沒有任何動作</strong>
                  <p>可以先從左側點技能加入，或直接讓 solver 幫你產生候選序列。</p>
                </div>
              ) : (
                <div className="history-list">
                  {sequence.map((actionId, index) => {
                    const step = simulation.steps[index]
                    return (
                      <article key={`${actionId}-${index}`} className="history-item">
                        <div className="history-item__top">
                          <strong>#{index + 1} {localizedActionNames[actionId]}</strong>
                          <span className={step?.isValid ? 'badge badge--positive' : 'badge badge--warning'}>
                            {step?.isValid ? step.condition.toUpperCase() : '無效'}
                          </span>
                        </div>
                        <p className="muted">{craftActionDefinitions.find((entry) => entry.id === actionId)?.label}</p>
                        {step ? (
                          <p className="muted">
                            進度 +{step.progressGain} / 品質 +{step.qualityGain} / 耐久變化 {step.durabilityChange} / CP 變化 {step.cpChange}
                          </p>
                        ) : null}
                        <div className="button-row">
                          <button
                            className="button button--ghost"
                            disabled={index === 0}
                            onClick={() =>
                              setSequence((current) => {
                                const next = [...current]
                                ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                                return next
                              })
                            }
                            type="button"
                          >
                            上移
                          </button>
                          <button
                            className="button button--ghost"
                            disabled={index === sequence.length - 1}
                            onClick={() =>
                              setSequence((current) => {
                                const next = [...current]
                                ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
                                return next
                              })
                            }
                            type="button"
                          >
                            下移
                          </button>
                          <button className="button button--ghost" onClick={() => setSequence((current) => current.filter((_, currentIndex) => currentIndex !== index))} type="button">
                            刪除
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </article>
          </div>
        )}

        {/* Tab: 模擬結果 */}
        {activeTab === 'result' && (
          <div className="tool-panel page-card">
            <div className="section-heading">
              <h2>模擬結果與 Macro 輸出</h2>
              <p>當前序列的即時模擬數據，以及對應的 FFXIV macro 分段輸出，技能名稱與等待時間對照 BestCraft 繁中格式。</p>
            </div>
            <div className="stats-grid">
              <article className="stat-card"><div className="stat-label">狀態</div><div className="stat-value">{formatStatus(simulation.finalState.status)}</div></article>
              <article className="stat-card"><div className="stat-label">進度</div><div className="stat-value">{simulation.completionPercent}%</div></article>
              <article className="stat-card"><div className="stat-label">品質</div><div className="stat-value">{simulation.qualityPercent}%</div></article>
              <article className="stat-card"><div className="stat-label">HQ 估算</div><div className="stat-value">{simulation.hqPercent}%</div></article>
              <article className="stat-card"><div className="stat-label">剩餘耐久</div><div className="stat-value">{simulation.finalState.durability}</div></article>
              <article className="stat-card"><div className="stat-label">剩餘 CP</div><div className="stat-value">{simulation.finalState.cp}</div></article>
              <article className="stat-card"><div className="stat-label">條件模式</div><div className="stat-value">{formatConditionMode(conditionMode)}</div></article>
            </div>
            {macroChunks.length === 0 ? (
              <div className="empty-state">
                <strong>目前沒有可輸出的 Macro</strong>
                <p>請先在「技能序列」頁籤中加入動作，或讓 solver 產生候選序列。</p>
                <button className="button button--ghost" onClick={() => setActiveTab('sequence')} type="button">
                  前往技能序列
                </button>
              </div>
            ) : (
              <>
                <div className="history-list">
                  {macroChunks.map((chunk, index) => {
                    const value = chunk.join('\n')
                    const label = `macro-${index}`
                    return (
                      <article key={label} className="history-item">
                        <div className="history-item__top">
                          <strong>Macro {index + 1}</strong>
                          <span className="badge">{chunk.length} 行</span>
                        </div>
                        <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}><code>{value}</code></pre>
                        <div className="button-row">
                          <button className="button button--primary" onClick={() => void handleCopy(label, value)} type="button">
                            {copiedLabel === label ? '已複製' : '複製這段 Macro'}
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>

                <div className="section-heading" style={{ marginTop: '1.5rem' }}>
                  <h2>逐步模擬明細</h2>
                  <p>每一步的進度增量、品質增量、耐久與 CP 變化，以及觸發的特殊備註。</p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '0.4rem 0.6rem', color: 'var(--ink-muted)', fontWeight: 500 }}>#</th>
                        <th style={{ padding: '0.4rem 0.6rem', color: 'var(--ink-muted)', fontWeight: 500 }}>技能</th>
                        <th style={{ padding: '0.4rem 0.6rem', color: 'var(--ink-muted)', fontWeight: 500 }}>條件</th>
                        <th style={{ padding: '0.4rem 0.6rem', color: 'var(--ink-muted)', fontWeight: 500, textAlign: 'right' }}>進度</th>
                        <th style={{ padding: '0.4rem 0.6rem', color: 'var(--ink-muted)', fontWeight: 500, textAlign: 'right' }}>品質</th>
                        <th style={{ padding: '0.4rem 0.6rem', color: 'var(--ink-muted)', fontWeight: 500, textAlign: 'right' }}>耐久</th>
                        <th style={{ padding: '0.4rem 0.6rem', color: 'var(--ink-muted)', fontWeight: 500, textAlign: 'right' }}>剩餘 CP</th>
                        <th style={{ padding: '0.4rem 0.6rem', color: 'var(--ink-muted)', fontWeight: 500 }}>備註</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulation.steps.map((step, index) => (
                        <tr
                          key={index}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: !step.isValid ? 'rgba(220,50,50,0.06)' : undefined,
                          }}
                        >
                          <td style={{ padding: '0.35rem 0.6rem', color: 'var(--ink-muted)' }}>{index + 1}</td>
                          <td style={{ padding: '0.35rem 0.6rem' }}>
                            <span style={{ color: !step.isValid ? 'var(--accent-danger, #f87171)' : undefined }}>
                              {localizedActionNames[step.actionId] ?? step.actionLabel}
                            </span>
                          </td>
                          <td style={{ padding: '0.35rem 0.6rem', color: 'var(--ink-muted)' }}>
                            {formatConditionLabel(step.condition)}
                          </td>
                          <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', color: step.progressGain > 0 ? 'var(--accent-strong, #fbbf24)' : 'var(--ink-muted)' }}>
                            {step.progressGain > 0 ? `+${step.progressGain}` : '—'}
                          </td>
                          <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', color: step.qualityGain > 0 ? '#86efac' : 'var(--ink-muted)' }}>
                            {step.qualityGain > 0 ? `+${step.qualityGain}` : '—'}
                          </td>
                          <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', color: step.durabilityChange < 0 ? '#f87171' : step.durabilityChange > 0 ? '#86efac' : 'var(--ink-muted)' }}>
                            {step.durabilityChange !== 0 ? (step.durabilityChange > 0 ? `+${step.durabilityChange}` : step.durabilityChange) : '—'}
                          </td>
                          <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right' }}>{step.resultingState.cp}</td>
                          <td style={{ padding: '0.35rem 0.6rem', color: 'var(--ink-muted)', fontSize: '0.8rem' }}>
                            {step.note ?? ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab: 相關任務 */}
        {activeTab === 'tasks' && (
          <div className="tool-panel page-card">
            <div className="section-heading">
              <h2>相關任務清單</h2>
              <p>如果你正在排老主顧或友好部落，也可以在這裡快速切換到對應追蹤內容。</p>
            </div>
            <label className="field">
              <span className="field-label">快速搜尋任務</span>
              <input className="input-text" onChange={(event) => setTaskSearchQuery(event.target.value)} placeholder="輸入名稱、地點或說明關鍵字" type="text" value={taskSearchQuery} />
            </label>
            <div className="choice-row">
              <button className={taskFilter === 'all' ? 'choice-button choice-button--active' : 'choice-button'} onClick={() => setTaskFilter('all')} type="button">全部相關</button>
              <button className={taskFilter === 'custom' ? 'choice-button choice-button--active' : 'choice-button'} onClick={() => setTaskFilter('custom')} type="button">老主顧</button>
              <button className={taskFilter === 'tribe-craft' ? 'choice-button choice-button--active' : 'choice-button'} onClick={() => setTaskFilter('tribe-craft')} type="button">友好部落 / 製作</button>
              <button className={taskFilter === 'tribe-gather' ? 'choice-button choice-button--active' : 'choice-button'} onClick={() => setTaskFilter('tribe-gather')} type="button">友好部落 / 採集</button>
            </div>
            {relevantTasks.length === 0 ? (
              <div className="empty-state"><strong>沒有符合的任務</strong><p>試著清除關鍵字或換個篩選條件。</p></div>
            ) : null}
            <div className="history-list">
              {relevantTasks.map((entry) => (
                <article key={entry.id} className="history-item">
                  <div className="history-item__top">
                    <strong>{entry.name}</strong>
                    <span className="badge">{entry.category === 'custom-deliveries' ? '老主顧' : '友好部落'}</span>
                  </div>
                  <p className="muted">
                    {entry.location} | Patch {entry.patch} | {entry.supportRoles.map((role) => formatSupportRole(role)).join(' / ')}
                  </p>
                  {entry.rewardSummary.length > 0 ? (
                    <div className="badge-row">
                      {entry.rewardSummary.map((item) => (
                        <button
                          key={item}
                          className="choice-button"
                          onClick={() => handleTaskSearch(item)}
                          title={`以「${item}」搜尋配方`}
                          type="button"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="button-row">
                    <button className="button button--ghost" onClick={() => handleTaskSearch(entry.name)} type="button">帶入搜尋</button>
                    <Link className="button button--ghost" to="/collection">前往收藏追蹤</Link>
                    {entry.sourceUrl ? <a className="button button--ghost" href={entry.sourceUrl} rel="noreferrer" target="_blank">查看來源</a> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      {message ? (
        <section className="page-card">
          <div className="callout">
            <span className="callout-title">狀態訊息</span>
            <span className="callout-body">{message}</span>
          </div>
        </section>
      ) : null}

      <SourceAttribution entries={pageSources.craft.entries} />
    </div>
  )
}

export default CraftPage
