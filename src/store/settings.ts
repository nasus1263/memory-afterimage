import type { ApiKeys, ModelConfig } from '../types'
import { DEFAULT_CONFIG } from '../config/models'

const KEYS_KEY = 'memory_afterimage_keys'
const CONFIG_KEY = 'memory_afterimage_config'

const DEFAULT_KEYS: ApiKeys = {
  google: '', nvidia: '', elevenlabs: '',
  freesound: '',
  restapi: '',
}

export function loadKeys(): ApiKeys {
  try {
    const raw = localStorage.getItem(KEYS_KEY)
    return raw ? { ...DEFAULT_KEYS, ...JSON.parse(raw) } : DEFAULT_KEYS
  } catch {
    return DEFAULT_KEYS
  }
}

export function saveKeys(keys: ApiKeys) {
  localStorage.setItem(KEYS_KEY, JSON.stringify(keys))
}

export function loadConfig(): ModelConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveConfig(config: ModelConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

const ANSWER_AUTOFILL_KEY = 'memory_answer_autofill_enabled'

export function isAnswerAutoFillEnabled(): boolean {
  const v = localStorage.getItem(ANSWER_AUTOFILL_KEY)
  return v === null ? true : v === 'true' // default ON
}

export function setAnswerAutoFillEnabled(on: boolean) {
  localStorage.setItem(ANSWER_AUTOFILL_KEY, on ? 'true' : 'false')
}
