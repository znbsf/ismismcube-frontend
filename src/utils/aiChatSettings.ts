export interface AiChatSettings {
  prompt: string
  content_size: number
  max_tokens: number
  temperature: number
  top_p: number
  frequency_penalty: number
  presence_penalty: number
  repeat_penalty: number
}

export type EditableAiSettings = Omit<AiChatSettings, 'content_size' | 'max_tokens'>
export type EditableAiSettingKey = keyof EditableAiSettings
export interface AiSettingsValidation {
  ok: boolean
  rejected: string[]
}

const EDITABLE_KEYS: EditableAiSettingKey[] = [
  'prompt', 'temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'repeat_penalty'
]
const EDITABLE_SET = new Set<string>(EDITABLE_KEYS)
const ALL_KEYS = new Set<string>([...EDITABLE_KEYS, 'content_size', 'max_tokens'])
const EMPTY_DEFAULTS: AiChatSettings = {
  prompt: '', content_size: 0, max_tokens: 0, temperature: 0,
  top_p: 0, frequency_penalty: 0, presence_penalty: 0, repeat_penalty: 0
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const validValue = (key: string, value: unknown): boolean => {
  if (key === 'prompt') return typeof value === 'string'
  if (typeof value !== 'number' || !Number.isFinite(value)) return false
  if (key === 'content_size' || key === 'max_tokens') return Number.isInteger(value) && value > 0
  if (key === 'temperature' || key === 'top_p') return value >= 0 && value <= 1
  if (key === 'frequency_penalty' || key === 'presence_penalty') return value >= -2 && value <= 2
  if (key === 'repeat_penalty') return value >= 0 && value <= 2
  return false
}

const editable = (settings: AiChatSettings): EditableAiSettings => ({
  prompt: settings.prompt,
  temperature: settings.temperature,
  top_p: settings.top_p,
  frequency_penalty: settings.frequency_penalty,
  presence_penalty: settings.presence_penalty,
  repeat_penalty: settings.repeat_penalty
})

/** In-memory settings only. UI drafts and service broadcasts have separate ownership. */
export function createAiChatSettings() {
  const defaults: AiChatSettings = { ...EMPTY_DEFAULTS }
  const knownServiceKeys = new Set<keyof AiChatSettings>()
  let overrides: Partial<EditableAiSettings> = {}
  let draft: EditableAiSettings | null = null
  let openedDraft: EditableAiSettings | null = null
  let resetSnapshot: EditableAiSettings | null = null

  const effective = (): AiChatSettings => ({ ...defaults, ...overrides })
  const closeDraft = () => { draft = openedDraft = resetSnapshot = null }

  const validateDraftPatch = (input: unknown): { values: Partial<EditableAiSettings>; rejected: string[] } => {
    if (!isRecord(input)) return { values: {}, rejected: ['value'] }
    const values: Record<string, unknown> = {}
    const rejected: string[] = []
    for (const [key, value] of Object.entries(input)) {
      if (!EDITABLE_SET.has(key) || !validValue(key, value)) rejected.push(key)
      else values[key] = value
    }
    return { values: values as Partial<EditableAiSettings>, rejected }
  }

  return {
    get serviceDefaults(): AiChatSettings { return { ...defaults } },
    get savedOverrides(): Partial<EditableAiSettings> { return { ...overrides } },
    get effective(): AiChatSettings { return effective() },
    get draft(): EditableAiSettings | null { return draft ? { ...draft } : null },
    get isOpen(): boolean { return draft !== null },
    // Only real service values or explicit user choices enter a request.
    // Placeholder zeroes for not-yet-received defaults remain display-only.
    get requestSettings(): Partial<EditableAiSettings> {
      return Object.fromEntries(EDITABLE_KEYS.filter(key => knownServiceKeys.has(key) || Object.prototype.hasOwnProperty.call(overrides, key))
        .map(key => [key, effective()[key]])) as Partial<EditableAiSettings>
    },
    updateServiceDefaults(input: unknown): AiSettingsValidation {
      if (!isRecord(input)) return { ok: false, rejected: ['value'] }
      const rejected: string[] = []
      for (const [key, value] of Object.entries(input)) {
        if (!ALL_KEYS.has(key) || !validValue(key, value)) {
          rejected.push(key)
          continue
        }
        Object.assign(defaults, { [key]: value })
        knownServiceKeys.add(key as keyof AiChatSettings)
      }
      // Never mutate draft or saved overrides, even while a modal is open.
      return { ok: rejected.length === 0, rejected }
    },
    openDraft(): EditableAiSettings {
      draft = editable(effective())
      openedDraft = { ...draft }
      resetSnapshot = null
      return { ...draft }
    },
    updateDraft(input: unknown): AiSettingsValidation {
      if (!draft) return { ok: false, rejected: ['draft-closed'] }
      const parsed = validateDraftPatch(input)
      if (parsed.rejected.length) return { ok: false, rejected: parsed.rejected }
      draft = { ...draft, ...parsed.values }
      return { ok: true, rejected: [] }
    },
    resetDraft(): EditableAiSettings | null {
      if (!draft) return null
      draft = editable(defaults)
      resetSnapshot = { ...draft }
      return { ...draft }
    },
    cancelDraft(): void { closeDraft() },
    saveDraft(input?: unknown): AiSettingsValidation {
      if (!draft || !openedDraft) return { ok: false, rejected: ['draft-closed'] }
      const parsed = validateDraftPatch(input === undefined ? draft : input)
      if (parsed.rejected.length) return { ok: false, rejected: parsed.rejected }
      const candidate = { ...draft, ...parsed.values }
      const next: Partial<EditableAiSettings> = resetSnapshot ? {} : { ...overrides }
      const comparison = resetSnapshot ?? openedDraft
      for (const key of EDITABLE_KEYS) {
        if (candidate[key] !== comparison[key]) Object.assign(next, { [key]: candidate[key] })
      }
      overrides = next
      closeDraft()
      return { ok: true, rejected: [] }
    }
  }
}
