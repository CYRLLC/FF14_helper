import { useEffect, useMemo, useState } from 'react'
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
  type CraftConditionMode,
  type CraftRecipe,
  type CraftSolverObjective,
  type CraftStats,
} from '../craft/simulator'
import { getErrorMessage } from '../utils/errors'

const STORAGE_KEY = 'ff14-helper.craft.workbench.v2'

type TaskFilter = 'all' | 'custom' | 'tribe-craft' | 'tribe-gather'

interface SavedCraftState {
  stats: CraftStats
  recipe: CraftRecipe
  sequence: CraftActionId[]
  importText: string
  conditionMode: CraftConditionMode
  solverObjective: CraftSolverObjective
  taskFilter: TaskFilter
}

function loadSavedState(): SavedCraftState {
  const fallback: SavedCraftState = {
    stats: createDefaultCraftStats(),
    recipe: createDefaultCraftRecipe(),
    sequence: [],
    importText: '',
    conditionMode: 'normal',
    solverObjective: 'balanced',
    taskFilter: 'all',
  }

  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<SavedCraftState>) } : fallback
  } catch {
    return fallback
  }
}

function groupActions(): Array<{ title: string; items: CraftActionDefinition[] }> {
  return [
    {
      title: '起手與進度',
      items: craftActionDefinitions.filter((action) =>
        ['reflect', 'muscleMemory', 'veneration', 'basicSynthesis', 'carefulSynthesis', 'groundwork', 'prudentSynthesis', 'focusedSynthesis', 'intensiveSynthesis', 'delicateSynthesis'].includes(action.id),
      ),
    },
    {
      title: '品質與收尾',
      items: craftActionDefinitions.filter((action) =>
        ['innovation', 'greatStrides', 'basicTouch', 'standardTouch', 'advancedTouch', 'prudentTouch', 'preparatoryTouch', 'focusedTouch', 'preciseTouch', 'trainedFinesse', 'byregotsBlessing'].includes(action.id),
      ),
    },
    {
      title: '耐久與輔助',
      items: craftActionDefinitions.filter((action) =>
        ['wasteNot', 'wasteNotII', 'manipulation', 'mastersMend', 'observe'].includes(action.id),
      ),
    },
  ]
}

function formatSupportRole(role: string): string {
  switch (role) {
    case 'crafting':
      return '製作'
    case 'gathering':
      return '採集'
    case 'fishing':
      return '釣魚'
    case 'combat':
      return '戰鬥'
    default:
      return role
  }
}

function formatConditionMode(mode: CraftConditionMode): string {
  return mode === 'favorable' ? 'Favorable 假設' : 'Normal 假設'
}

function formatStatus(status: 'running' | 'completed' | 'broken'): string {
  switch (status) {
    case 'completed':
      return '已完成'
    case 'broken':
      return '失敗'
    default:
      return '進行中'
  }
}

function copyText(value: string): Promise<void> {
  return navigator.clipboard.writeText(value)
}

function CraftPage() {
  const [savedState] = useState(() => loadSavedState())
  const [stats, setStats] = useState<CraftStats>(savedState.stats)
  const [recipe, setRecipe] = useState<CraftRecipe>(savedState.recipe)
  const [sequence, setSequence] = useState<CraftActionId[]>(savedState.sequence)
  const [importText, setImportText] = useState(savedState.importText)
  const [conditionMode, setConditionMode] = useState<CraftConditionMode>(savedState.conditionMode)
  const [solverObjective, setSolverObjective] = useState<CraftSolverObjective>(savedState.solverObjective)
  const [taskFilter, setTaskFilter] = useState<TaskFilter>(savedState.taskFilter)
  const [message, setMessage] = useState<string | null>(null)
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [recipeResults, setRecipeResults] = useState<XivapiRecipeSearchResult[]>([])
  const [itemResults, setItemResults] = useState<XivapiSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedRecipeRowId, setSelectedRecipeRowId] = useState<number | null>(null)
  const [solverLoading, setSolverLoading] = useState(false)
  const [solverNotes, setSolverNotes] = useState<string[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ stats, recipe, sequence, importText, conditionMode, solverObjective, taskFilter } satisfies SavedCraftState),
    )
  }, [conditionMode, importText, recipe, sequence, solverObjective, stats, taskFilter])

  const simulation = useMemo(() => simulateCraft(stats, recipe, sequence, { conditionMode }), [conditionMode, recipe, sequence, stats])
  const actionGroups = useMemo(() => groupActions(), [])
  const macroChunks = useMemo(() => buildMacroChunks(sequence), [sequence])

  const relevantTasks = useMemo(() => {
    return collectionEntries.filter((entry) => {
      switch (taskFilter) {
        case 'custom':
          return entry.category === 'custom-deliveries'
        case 'tribe-craft':
          return entry.category === 'allied-societies' && entry.supportRoles.includes('crafting')
        case 'tribe-gather':
          return entry.category === 'allied-societies' && entry.supportRoles.includes('gathering')
        default:
          return entry.category === 'custom-deliveries' || entry.supportRoles.includes('crafting') || entry.supportRoles.includes('gathering')
      }
    })
  }, [taskFilter])

  function updateStats<K extends keyof CraftStats>(key: K, value: number): void {
    setStats((current) => ({ ...current, [key]: value }))
  }

  function updateRecipe<K extends keyof CraftRecipe>(key: K, value: CraftRecipe[K]): void {
    setRecipe((current) => ({ ...current, [key]: value }))
  }

  function addAction(actionId: CraftActionId): void {
    setSequence((current) => [...current, actionId])
    setMessage(`已加入 ${craftActionDefinitions.find((action) => action.id === actionId)?.label ?? actionId}。`)
  }

  function applyPreset(presetId: string): void {
    const preset = craftRecipePresets.find((entry) => entry.id === presetId)
    if (!preset) {
      return
    }

    setRecipe({ ...preset.recipe })
    setSelectedRecipeRowId(null)
    setMessage(`已套用預設配方：${preset.label}。`)
  }

  function moveAction(index: number, direction: -1 | 1): void {
    setSequence((current) => {
      const next = [...current]
      const targetIndex = index + direction
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
  }

  function removeAction(index: number): void {
    setSequence((current) => current.filter((_, actionIndex) => actionIndex !== index))
  }

  async function handleCopy(label: string, value: string): Promise<void> {
    try {
      await copyText(value)
      setCopiedLabel(label)
      setMessage('內容已複製到剪貼簿。')
      window.setTimeout(() => setCopiedLabel((current) => (current === label ? null : current)), 1500)
    } catch (error) {
      setMessage(getErrorMessage(error))
    }
  }

  function handleImportMacro(): void {
    const parsed = parseMacroText(importText)
    if (parsed.length === 0) {
      setMessage('沒有辨識到可用的動作名稱或 macro 指令。')
      return
    }

    setSequence(parsed)
    setMessage(`已匯入 ${parsed.length} 個動作。`)
  }

  async function handleRecipeSearch(): Promise<void> {
    const term = searchQuery.trim()
    if (term.length < 2) {
      setMessage('請至少輸入 2 個字元。')
      return
    }

    setSearchLoading(true)
    setMessage(null)

    try {
      const [recipes, items] = await Promise.all([
        searchRecipeResults(term, 8),
        searchXivapi(term, 'Item', 8),
      ])

      setRecipeResults(recipes)
      setItemResults(items)
      setMessage(`已完成搜尋，找到 ${recipes.length} 筆配方與 ${items.length} 筆道具。`)
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setSearchLoading(false)
    }
  }

  async function applyRecipeFromRow(rowId: number): Promise<void> {
    try {
      const detail = await fetchRecipeDetails(rowId)
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
        setSolverNotes(['Solver 沒有產生候選結果。'])
        setMessage('Solver 沒有找到可用序列。')
        return
      }

      setSolverNotes([
        ...result.notes,
        `探索節點：${result.exploredStates.toLocaleString('zh-TW')}。`,
        `預估結果：${formatStatus(result.simulation.finalState.status)}，進度 ${result.simulation.completionPercent}% / 品質 ${result.simulation.qualityPercent}%。`,
      ])
      setSequence(result.sequence)
      setMessage('已將 solver 產生的序列套用到工作台。')
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setSolverLoading(false)
    }
  }

  function handleReset(): void {
    setStats(createDefaultCraftStats())
    setRecipe(createDefaultCraftRecipe())
    setSequence([])
    setImportText('')
    setConditionMode('normal')
    setSolverObjective('balanced')
    setSelectedRecipeRowId(null)
    setSolverNotes([])
    setMessage('已重設製作助手。')
  }

  return (
    <div className="page-grid">
      <section className="hero-card">
        <p className="eyebrow">Craft Workbench</p>
        <h2>製作助手</h2>
        <p className="lead">
          這一頁把 `BestCraft` 類型的工作流整理成本站自己的製作面板，重點是三件事：
          `配方搜尋與帶入`、`完整 rotations 模擬`、`站內 solver`。資料搜尋使用 XIVAPI v2，
          介面與文案則完全重新整理成本站風格。
        </p>
        <div className="badge-row">
          <span className="badge badge--positive">站內完整工作流</span>
          <span className="badge">BestCraft 參考來源已標註</span>
          <span className="badge badge--warning">XIVAPI v2 目前無繁中配方名稱</span>
        </div>
        <div className="button-row">
          <Link className="button button--ghost" to="/collection">
            查看老主顧 / 友好部落清單
          </Link>
          <a className="button button--ghost" href="https://github.com/Tnze/ffxiv-best-craft" rel="noreferrer" target="_blank">
            查看 BestCraft 原始專案
          </a>
        </div>
      </section>

      <section className="source-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>製作者屬性</h2>
            <p>這些數值會直接影響進度、品質與 solver 結果。</p>
          </div>
          <div className="field-grid">
            <label className="field">
              <span className="field-label">等級</span>
              <input className="input-text" min="1" onChange={(event) => updateStats('level', Number(event.target.value))} type="number" value={stats.level} />
            </label>
            <label className="field">
              <span className="field-label">Craftsmanship</span>
              <input className="input-text" min="1" onChange={(event) => updateStats('craftsmanship', Number(event.target.value))} type="number" value={stats.craftsmanship} />
            </label>
            <label className="field">
              <span className="field-label">Control</span>
              <input className="input-text" min="1" onChange={(event) => updateStats('control', Number(event.target.value))} type="number" value={stats.control} />
            </label>
            <label className="field">
              <span className="field-label">CP</span>
              <input className="input-text" min="1" onChange={(event) => updateStats('cp', Number(event.target.value))} type="number" value={stats.cp} />
            </label>
          </div>
        </article>

        <article className="page-card">
          <div className="section-heading">
            <h2>Solver 與條件假設</h2>
            <p>條件模式是推演假設，不是遊戲內隨機條件的逐格還原。</p>
          </div>
          <div className="field-grid">
            <label className="field">
              <span className="field-label">條件模式</span>
              <select className="input-select" onChange={(event) => setConditionMode(event.target.value as CraftConditionMode)} value={conditionMode}>
                <option value="normal">Normal 假設</option>
                <option value="favorable">Favorable 假設</option>
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
              {solverLoading ? 'Solver 計算中…' : '產生建議序列'}
            </button>
            <button className="button button--ghost" onClick={handleReset} type="button">
              全部重設
            </button>
          </div>
          {solverNotes.length > 0 ? (
            <div className="callout">
              <span className="callout-title">Solver 摘要</span>
              <div className="detail-list">
                {solverNotes.map((note) => (
                  <span key={note}>{note}</span>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>配方搜尋與自動帶入</h2>
          <p>
            使用 XIVAPI v2 搜尋 `Recipe / Item`。由於 XIVAPI v2 目前沒有繁中配方名稱，這裡建議用
            英文或日文關鍵字搜尋；帶入後頁面仍會用繁中說明工作流。
          </p>
        </div>
        <div className="field-grid">
          <label className="field">
            <span className="field-label">搜尋關鍵字</span>
            <input className="input-text" onChange={(event) => setSearchQuery(event.target.value)} placeholder="例如 Tacos、Bronze Ingot、Potion" type="text" value={searchQuery} />
          </label>
        </div>
        <div className="button-row">
          <button className="button button--primary" disabled={searchLoading} onClick={() => void handleRecipeSearch()} type="button">
            {searchLoading ? '搜尋中…' : '搜尋配方 / 道具'}
          </button>
        </div>
        <div className="source-grid">
          <article className="list-panel">
            <p className="callout-title">配方結果</p>
            {recipeResults.length === 0 ? (
              <p className="muted">尚未搜尋，或目前沒有找到配方結果。</p>
            ) : (
              <div className="history-list">
                {recipeResults.map((result) => (
                  <article key={result.rowId} className="history-item">
                    <div className="history-item__top">
                      <strong>{result.name}</strong>
                      <span className={selectedRecipeRowId === result.rowId ? 'badge badge--positive' : 'badge'}>
                        {result.craftTypeName ?? 'Unknown'}
                      </span>
                    </div>
                    <p className="muted">Recipe Row #{result.rowId}</p>
                    <div className="button-row">
                      <button className="button button--ghost" onClick={() => void applyRecipeFromRow(result.rowId)} type="button">
                        帶入這個配方
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className="list-panel">
            <p className="callout-title">道具結果</p>
            {itemResults.length === 0 ? (
              <p className="muted">尚未搜尋，或目前沒有找到道具結果。</p>
            ) : (
              <div className="history-list">
                {itemResults.map((item) => (
                  <article key={item.rowId} className="history-item">
                    <div className="history-item__top">
                      <strong>{item.name}</strong>
                      <span className="badge">Item Row #{item.rowId}</span>
                    </div>
                    <div className="button-row">
                      <button className="button button--ghost" onClick={() => void applyRecipeFromItem(item)} type="button">
                        找對應配方並帶入
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>

      <section className="source-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>配方設定</h2>
            <p>可以手動調整，也可以直接套用預設或 API 帶入的配方。</p>
          </div>
          <div className="choice-row">
            {craftRecipePresets.map((preset) => (
              <button key={preset.id} className="choice-button" onClick={() => applyPreset(preset.id)} type="button">
                <strong>{preset.label}</strong>
                <p className="muted">{preset.note}</p>
              </button>
            ))}
          </div>
          <div className="field-grid">
            <label className="field">
              <span className="field-label">配方名稱</span>
              <input className="input-text" onChange={(event) => updateRecipe('name', event.target.value)} type="text" value={recipe.name} />
            </label>
            <label className="field">
              <span className="field-label">配方等級</span>
              <input className="input-text" min="1" onChange={(event) => updateRecipe('level', Number(event.target.value))} type="number" value={recipe.level} />
            </label>
            <label className="field">
              <span className="field-label">Difficulty</span>
              <input className="input-text" min="1" onChange={(event) => updateRecipe('difficulty', Number(event.target.value))} type="number" value={recipe.difficulty} />
            </label>
            <label className="field">
              <span className="field-label">Quality 上限</span>
              <input className="input-text" min="0" onChange={(event) => updateRecipe('quality', Number(event.target.value))} type="number" value={recipe.quality} />
            </label>
            <label className="field">
              <span className="field-label">Durability</span>
              <input className="input-text" min="1" onChange={(event) => updateRecipe('durability', Number(event.target.value))} type="number" value={recipe.durability} />
            </label>
            <label className="field">
              <span className="field-label">初始品質</span>
              <input className="input-text" min="0" onChange={(event) => updateRecipe('initialQuality', Number(event.target.value))} type="number" value={recipe.initialQuality} />
            </label>
            <label className="field">
              <span className="field-label">Progress Divider</span>
              <input className="input-text" min="1" onChange={(event) => updateRecipe('progressDivider', Number(event.target.value))} type="number" value={recipe.progressDivider} />
            </label>
            <label className="field">
              <span className="field-label">Progress Modifier</span>
              <input className="input-text" min="1" onChange={(event) => updateRecipe('progressModifier', Number(event.target.value))} type="number" value={recipe.progressModifier} />
            </label>
            <label className="field">
              <span className="field-label">Quality Divider</span>
              <input className="input-text" min="1" onChange={(event) => updateRecipe('qualityDivider', Number(event.target.value))} type="number" value={recipe.qualityDivider} />
            </label>
            <label className="field">
              <span className="field-label">Quality Modifier</span>
              <input className="input-text" min="1" onChange={(event) => updateRecipe('qualityModifier', Number(event.target.value))} type="number" value={recipe.qualityModifier} />
            </label>
          </div>
        </article>

        <article className="page-card">
          <div className="section-heading">
            <h2>目前帶入的配方資訊</h2>
            <p>這一塊會顯示 API 帶入後的工作資訊，方便你確認是不是正確配方。</p>
          </div>
          <div className="stats-grid">
            <article className="stat-card">
              <div className="stat-label">來源</div>
              <div className="stat-value">{recipe.source ?? '手動輸入 / 預設'}</div>
            </article>
            <article className="stat-card">
              <div className="stat-label">職業</div>
              <div className="stat-value">{recipe.jobName ?? '未指定'}</div>
            </article>
            <article className="stat-card">
              <div className="stat-label">HQ</div>
              <div className="stat-value">{recipe.canHq === false ? '不可 HQ' : '可 HQ'}</div>
            </article>
            <article className="stat-card">
              <div className="stat-label">產量</div>
              <div className="stat-value">{recipe.yield ?? 1}</div>
            </article>
          </div>
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
              <strong>目前沒有材料清單。</strong>
              <p>如果你用手動輸入配方，這裡會保持空白；使用 API 帶入時才會顯示材料。</p>
            </div>
          )}
        </article>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>任務來源篩選</h2>
          <p>這一區把老主顧與友好部落資料接回製作頁，方便你快速鎖定常做內容。</p>
        </div>
        <div className="choice-row">
          <button className={taskFilter === 'all' ? 'choice-button choice-button--active' : 'choice-button'} onClick={() => setTaskFilter('all')} type="button">全部</button>
          <button className={taskFilter === 'custom' ? 'choice-button choice-button--active' : 'choice-button'} onClick={() => setTaskFilter('custom')} type="button">老主顧</button>
          <button className={taskFilter === 'tribe-craft' ? 'choice-button choice-button--active' : 'choice-button'} onClick={() => setTaskFilter('tribe-craft')} type="button">友好部落 / 製作</button>
          <button className={taskFilter === 'tribe-gather' ? 'choice-button choice-button--active' : 'choice-button'} onClick={() => setTaskFilter('tribe-gather')} type="button">友好部落 / 採集</button>
        </div>
        <div className="history-list">
          {relevantTasks.map((entry) => (
            <article key={entry.id} className="history-item">
              <div className="history-item__top">
                <strong>{entry.name}</strong>
                <span className="badge">{entry.category === 'custom-deliveries' ? '老主顧' : '友好部落'}</span>
              </div>
              <p className="muted">{entry.location} | Patch {entry.patch}</p>
              <p className="muted">支援：{entry.supportRoles.map((role) => formatSupportRole(role)).join(' / ')}</p>
              <p className="muted">{entry.unlockSummary}</p>
              <div className="button-row">
                <Link className="button button--ghost" to="/collection">
                  前往收藏追蹤
                </Link>
                {entry.sourceUrl ? (
                  <a className="button button--ghost" href={entry.sourceUrl} rel="noreferrer" target="_blank">
                    查看來源資料
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="page-card">
        <div className="section-heading">
          <h2>技能面板</h2>
          <p>技能名稱保留英文，以降低與外部工具或巨集對照時的辨識成本；說明維持繁中。</p>
        </div>
        <div className="source-grid">
          {actionGroups.map((group) => (
            <article key={group.title} className="list-panel">
              <p className="callout-title">{group.title}</p>
              <div className="history-list">
                {group.items.map((action) => (
                  <button key={action.id} className="choice-button" onClick={() => addAction(action.id)} type="button">
                    <strong>{action.label}</strong>
                    <p className="muted">CP {action.cpCost} | 耐久 {action.durabilityCost}</p>
                    <p className="muted">{action.description}</p>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="page-card">
        <div className="section-heading">
          <h2>目前序列與模擬結果</h2>
          <p>你可以手動排動作，也可以先讓 solver 產生，再回來手調收尾。</p>
        </div>
        <div className="stats-grid">
          <article className="stat-card">
            <div className="stat-label">步數</div>
            <div className="stat-value">{sequence.length}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">進度</div>
            <div className="stat-value">{simulation.finalState.progress} / {recipe.difficulty}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">品質</div>
            <div className="stat-value">{simulation.finalState.quality} / {recipe.quality}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">剩餘耐久</div>
            <div className="stat-value">{simulation.finalState.durability}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">剩餘 CP</div>
            <div className="stat-value">{simulation.finalState.cp}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">HQ 估算</div>
            <div className="stat-value">{simulation.hqPercent}%</div>
          </article>
        </div>
        <div className="callout">
          <span className="callout-title">模擬狀態</span>
          <div className="detail-list">
            <span>條件模式：{formatConditionMode(conditionMode)}</span>
            <span>最終狀態：{formatStatus(simulation.finalState.status)}</span>
            <span>完成度：{simulation.completionPercent}%</span>
            <span>品質達成：{simulation.qualityPercent}%</span>
            <span>Inner Quiet：{simulation.finalState.innerQuiet}</span>
          </div>
        </div>
        <div className="button-row">
          <button className="button button--ghost" onClick={() => setSequence([])} type="button">清空序列</button>
          <button className="button button--ghost" onClick={() => setSequence((current) => [...current, 'observe'])} type="button">快速插入 Observe</button>
        </div>
        {sequence.length === 0 ? (
          <div className="empty-state">
            <strong>目前還沒有序列。</strong>
            <p>可以從技能面板逐手加入，也可以先使用 solver 產生一版建議。</p>
          </div>
        ) : (
          <div className="history-list">
            {sequence.map((actionId, index) => {
              const action = craftActionDefinitions.find((entry) => entry.id === actionId)
              const step = simulation.steps[index]
              return (
                <article key={`${actionId}-${index}`} className="history-item">
                  <div className="history-item__top">
                    <strong>#{index + 1} | {action?.label ?? actionId}</strong>
                    <span className={step?.isValid ? 'badge badge--positive' : 'badge badge--warning'}>
                      {step?.isValid ? step.condition.toUpperCase() : '無效'}
                    </span>
                  </div>
                  <p className="muted">
                    {step
                      ? `進度 +${step.progressGain} / 品質 +${step.qualityGain} / 耐久 ${step.durabilityChange} / CP ${step.cpChange}`
                      : '尚未計算'}
                  </p>
                  {step?.note ? <p className="muted">{step.note}</p> : null}
                  <div className="button-row">
                    <button className="button button--ghost" disabled={index === 0} onClick={() => moveAction(index, -1)} type="button">往前</button>
                    <button className="button button--ghost" disabled={index === sequence.length - 1} onClick={() => moveAction(index, 1)} type="button">往後</button>
                    <button className="button button--ghost" onClick={() => removeAction(index)} type="button">刪除</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="source-grid">
        <article className="page-card">
          <div className="section-heading">
            <h2>Macro 匯入 / 匯出</h2>
            <p>可以貼現有巨集進來解析，也可以把目前序列切成遊戲內可貼上的 macro 分段。</p>
          </div>
          <label className="field">
            <span className="field-label">匯入文字</span>
            <textarea className="input-text" onChange={(event) => setImportText(event.target.value)} rows={6} value={importText} />
          </label>
          <div className="button-row">
            <button className="button button--ghost" onClick={handleImportMacro} type="button">解析 macro 文字</button>
            <button className="button button--ghost" onClick={() => setImportText('')} type="button">清空文字</button>
          </div>
        </article>

        <article className="page-card">
          <div className="section-heading">
            <h2>Macro 輸出</h2>
            <p>每段最多 15 行，直接對應遊戲內 macro 限制。</p>
          </div>
          {macroChunks.length === 0 ? (
            <div className="empty-state">
              <strong>目前沒有可輸出的 macro。</strong>
              <p>請先加入動作，或從上方貼入現成巨集。</p>
            </div>
          ) : (
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
                        {copiedLabel === label ? '已複製' : '複製這段 macro'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </article>
      </section>

      {message ? (
        <section className="page-card">
          <div className="callout">
            <span className="callout-title">訊息</span>
            <span className="callout-body">{message}</span>
          </div>
        </section>
      ) : null}

      <SourceAttribution entries={pageSources.craft.entries} />
    </div>
  )
}

export default CraftPage
