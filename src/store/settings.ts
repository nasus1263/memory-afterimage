import type { ApiKeys, ModelConfig } from '../types'
import { DEFAULT_CONFIG } from '../config/models'

const KEYS_KEY = 'memory_afterimage_keys'
const CONFIG_KEY = 'memory_afterimage_config'

const DEFAULT_KEYS: ApiKeys = {
  openai: '', anthropic: '', google: '', nvidia: '', elevenlabs: '',
  fal: '', replicate: '', huggingface: '',
  freesound: '', jamendo: '',
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
