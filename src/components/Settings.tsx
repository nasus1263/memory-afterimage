import { useState } from 'react'
import type { ApiKeys, ModelConfig } from '../types'
import {
  LLM_MODELS, TTS_MODELS, TTS_VOICES,
  IMAGE_MODELS, VIDEO_MODELS,
} from '../config/models'
import { isDebugMode, setDebugMode } from '../services/debug'

interface Props {
  keys: ApiKeys
  config: ModelConfig
  onKeys: (k: ApiKeys) => void
  onConfig: (c: ModelConfig) => void
}

function KeyInput({
  label, value, onChange, hint,
}: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="key-row">
      <label>{label}</label>
      <div className="key-input-wrap">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          placeholder="sk-..."
          onChange={(e) => onChange(e.target.value)}
        />
        <button className="show-btn" onClick={() => setShow((s) => !s)}>
          {show ? '숨김' : '표시'}
        </button>
      </div>
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function Settings({ keys, config, onKeys, onConfig }: Props) {
  const ttsVoices = TTS_VOICES[config.tts.provider] ?? []
  const [debug, setDebug] = useState(isDebugMode())

  function toggleDebug(on: boolean) {
    setDebugMode(on)
    setDebug(on)
  }

  return (
    <div className="settings">
      <section>
        <h3>디버그</h3>
        <label className="debug-toggle">
          <input
            type="checkbox"
            checked={debug}
            onChange={(e) => toggleDebug(e.target.checked)}
          />
          <span>디버그 모드</span>
          <span className="hint">이미지·동영상 API 호출 건너뜀 → 더미 파일 반환</span>
        </label>
      </section>

      <section>
        <h3>API 키</h3>
        <KeyInput label="OpenAI" value={keys.openai} onChange={(v) => onKeys({ ...keys, openai: v })} />
        <KeyInput label="Anthropic" value={keys.anthropic} onChange={(v) => onKeys({ ...keys, anthropic: v })} hint="※ 브라우저 CORS 제한 있을 수 있음" />
        <KeyInput label="Google AI Studio" value={keys.google} onChange={(v) => onKeys({ ...keys, google: v })} hint="무료 티어 사용 가능" />
        <KeyInput label="NVIDIA NIM (nvapi-...)" value={keys.nvidia} onChange={(v) => onKeys({ ...keys, nvidia: v })} hint="✓ 무료 1000크레딧 — build.nvidia.com 무료 계정 후 API Keys 탭" />
        <KeyInput label="fal.ai" value={keys.fal} onChange={(v) => onKeys({ ...keys, fal: v })} hint="$20 가입 크레딧 (비즈니스 이메일)" />
        <KeyInput label="Replicate" value={keys.replicate} onChange={(v) => onKeys({ ...keys, replicate: v })} hint="신규 계정 무료 predictions 한도" />
        <KeyInput label="HuggingFace" value={keys.huggingface} onChange={(v) => onKeys({ ...keys, huggingface: v })} hint="✓ 무료 Serverless Inference API (계정 없이도 가능)" />
        <KeyInput label="Freesound" value={keys.freesound} onChange={(v) => onKeys({ ...keys, freesound: v })} hint="✓ 무료 — freesound.org 계정 후 /apiv2/apply 에서 키 발급" />
        <KeyInput label="Jamendo" value={keys.jamendo} onChange={(v) => onKeys({ ...keys, jamendo: v })} hint="✓ 무료 — developers.jamendo.com 에서 client_id 발급" />
      </section>

      <section>
        <h3>모델 선택</h3>

        <div className="model-group">
          <label>LLM (본문 다듬기)</label>
          <select
            value={config.llm.provider}
            onChange={(e) => onConfig({ ...config, llm: { ...config.llm, provider: e.target.value as any, model: LLM_MODELS[e.target.value as keyof typeof LLM_MODELS][0].id } })}
          >
            {Object.keys(LLM_MODELS).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={config.llm.model}
            onChange={(e) => onConfig({ ...config, llm: { ...config.llm, model: e.target.value } })}
          >
            {LLM_MODELS[config.llm.provider].map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="model-group">
          <label>TTS</label>
          <select
            value={config.tts.provider}
            onChange={(e) => {
              const p = e.target.value as any
              onConfig({ ...config, tts: { provider: p, model: TTS_MODELS[p as keyof typeof TTS_MODELS][0].id, voice: TTS_VOICES[p as keyof typeof TTS_VOICES]?.[0] ?? '' } })
            }}
          >
            {Object.keys(TTS_MODELS).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={config.tts.model}
            onChange={(e) => onConfig({ ...config, tts: { ...config.tts, model: e.target.value } })}
          >
            {TTS_MODELS[config.tts.provider as keyof typeof TTS_MODELS]?.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          {ttsVoices.length > 0 && (
            <select
              value={config.tts.voice}
              onChange={(e) => onConfig({ ...config, tts: { ...config.tts, voice: e.target.value } })}
            >
              {ttsVoices.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
        </div>

        <div className="model-group">
          <label>이미지 생성</label>
          <select
            value={config.image.provider}
            onChange={(e) => {
              const p = e.target.value as any
              onConfig({ ...config, image: { provider: p, model: IMAGE_MODELS[p as keyof typeof IMAGE_MODELS][0].id } })
            }}
          >
            {Object.keys(IMAGE_MODELS).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={config.image.model}
            onChange={(e) => onConfig({ ...config, image: { ...config.image, model: e.target.value } })}
          >
            {IMAGE_MODELS[config.image.provider as keyof typeof IMAGE_MODELS]?.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="model-group">
          <label>이미지 → 동영상</label>
          <select
            value={config.video.provider}
            onChange={(e) => {
              const p = e.target.value as any
              onConfig({ ...config, video: { provider: p, model: VIDEO_MODELS[p as keyof typeof VIDEO_MODELS][0].id } })
            }}
          >
            {Object.keys(VIDEO_MODELS).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={config.video.model}
            onChange={(e) => onConfig({ ...config, video: { ...config.video, model: e.target.value } })}
          >
            {VIDEO_MODELS[config.video.provider as keyof typeof VIDEO_MODELS]?.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="model-group">
          <label>앰비언트 오디오 출처</label>
          <select
            value={config.audio.provider}
            onChange={(e) => onConfig({ ...config, audio: { provider: e.target.value as any } })}
          >
            <option value="freesound">Freesound ✓무료 (freesound.org)</option>
            <option value="jamendo">Jamendo ✓무료 (developers.jamendo.com)</option>
          </select>
        </div>
      </section>
    </div>
  )
}
