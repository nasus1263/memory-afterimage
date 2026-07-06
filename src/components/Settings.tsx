import { useState } from 'react'
import type { ApiKeys, ModelConfig } from '../types'
import {
  LLM_MODELS, TTS_MODELS, TTS_VOICES,
  IMAGE_MODELS,
} from '../config/models'
import { isAutoAnswerMode, setAutoAnswerMode, isDummyImageMode, setDummyImageMode } from '../services/debug'
import { isAnswerAutoFillEnabled, setAnswerAutoFillEnabled } from '../store/settings'
import { ApiTest } from './ApiTest'

interface Props {
  keys: ApiKeys
  config: ModelConfig
  onKeys: (k: ApiKeys) => void
  onConfig: (c: ModelConfig) => void
}

const selectCls = 'bg-surface2 border border-border text-text py-1.5 px-2.5 rounded text-sm mr-1.5 mb-1 cursor-pointer focus:outline-none focus:border-gold-dim'
const groupLabelCls = 'block text-xs text-text-dim mb-1'

function KeyInput({
  label, value, onChange, hint, placeholder = 'sk-...', secret = true,
}: { label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string; secret?: boolean }) {
  const [show, setShow] = useState(false)
  return (
    <div className="mb-2.5">
      <label className={groupLabelCls}>{label}</label>
      <div className="flex gap-1.5">
        <input
          className="flex-1 bg-surface2 border border-border text-text py-1.5 px-2.5 rounded text-sm font-mono focus:outline-none focus:border-gold-dim"
          type={secret && !show ? 'password' : 'text'}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {secret && (
          <button
            className="bg-transparent border border-border text-text-dim py-1.5 px-2.5 rounded text-xs whitespace-nowrap cursor-pointer"
            onClick={() => setShow((s) => !s)}
          >
            {show ? '숨김' : '표시'}
          </button>
        )}
      </div>
      {hint && <span className="block text-[12px] text-text-dim mt-0.5">{hint}</span>}
    </div>
  )
}

export function Settings({ keys, config, onKeys, onConfig }: Props) {
  const ttsVoices = TTS_VOICES[config.tts.provider] ?? []
  const [autoAnswer, setAutoAnswer] = useState(isAutoAnswerMode())
  const [dummyImage, setDummyImage] = useState(isDummyImageMode())
  const [answerAutoFill, setAnswerAutoFill] = useState(isAnswerAutoFillEnabled())

  function toggleAutoAnswer(on: boolean) {
    setAutoAnswerMode(on)
    setAutoAnswer(on)
  }

  function toggleAnswerAutoFill(on: boolean) {
    setAnswerAutoFillEnabled(on)
    setAnswerAutoFill(on)
  }

  function toggleDummyImage(on: boolean) {
    setDummyImageMode(on)
    setDummyImage(on)
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="text-gold-dim text-[12px] tracking-wider uppercase mb-3.5">답변 자동 생성 버튼</h3>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            className="mt-0.5 accent-gold-dim cursor-pointer shrink-0"
            type="checkbox"
            checked={answerAutoFill}
            onChange={(e) => toggleAnswerAutoFill(e.target.checked)}
          />
          <span className="text-text text-sm font-medium">답변 자동 생성 버튼 활성화</span>
          <span className="inline text-[12px] text-text-dim ml-2">추가 질문 답변 화면마다 추론 모델로 답변 초안을 생성하는 버튼 표시 (음성 답변에서는 답변만 채우고 다음 단계로 자동 진행하지 않음)</span>
        </label>
      </section>

      <section>
        <h3 className="text-gold-dim text-[12px] tracking-wider uppercase mb-3.5">디버그</h3>
        <label className="flex items-start gap-2.5 cursor-pointer mb-2">
          <input
            className="mt-0.5 accent-running cursor-pointer shrink-0"
            type="checkbox"
            checked={autoAnswer}
            onChange={(e) => toggleAutoAnswer(e.target.checked)}
          />
          <span className="text-running text-sm font-medium">답변 자동 생성</span>
          <span className="inline text-[12px] text-text-dim ml-2">추가 질문에 LLM이 자동으로 답변 채움</span>
        </label>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            className="mt-0.5 accent-running cursor-pointer shrink-0"
            type="checkbox"
            checked={dummyImage}
            onChange={(e) => toggleDummyImage(e.target.checked)}
          />
          <span className="text-running text-sm font-medium">더미 이미지 사용</span>
          <span className="inline text-[12px] text-text-dim ml-2">이미지 API 호출 건너뜀 → sample 이미지 반환</span>
        </label>
      </section>

      <section>
        <h3 className="text-gold-dim text-[12px] tracking-wider uppercase mb-3.5">API 키</h3>
        <KeyInput label="Google AI Studio" value={keys.google} onChange={(v) => onKeys({ ...keys, google: v })} hint="무료 티어 사용 가능" />
        <KeyInput label="NVIDIA NIM (nvapi-...)" value={keys.nvidia} onChange={(v) => onKeys({ ...keys, nvidia: v })} hint="✓ 무료 1000크레딧 — build.nvidia.com 무료 계정 후 API Keys 탭" />
        <KeyInput label="ElevenLabs" value={keys.elevenlabs} onChange={(v) => onKeys({ ...keys, elevenlabs: v })} hint="✓ 무료 10K chars/월 — elevenlabs.io → Profile → API Key" />
        <KeyInput label="Freesound" value={keys.freesound} onChange={(v) => onKeys({ ...keys, freesound: v })} hint="✓ 무료 — freesound.org 계정 후 /apiv2/apply 에서 키 발급" />
        <KeyInput
          label="REST API 이미지 서버 주소"
          value={keys.restapi}
          onChange={(v) => onKeys({ ...keys, restapi: v })}
          placeholder="http://localhost:8000"
          secret={false}
          hint="자체 호스팅 ComfyUI REST API 서버 주소 (이미지 생성 제공자에서 'restapi' 선택 시 사용)"
        />
      </section>

      <section>
        <h3 className="text-gold-dim text-[12px] tracking-wider uppercase mb-3.5">모델 선택</h3>

        <div className="mb-3">
          <label className={groupLabelCls}>LLM (본문 다듬기)</label>
          <select
            className={selectCls}
            value={config.llm.provider}
            onChange={(e) => onConfig({ ...config, llm: { ...config.llm, provider: e.target.value as any, model: LLM_MODELS[e.target.value as keyof typeof LLM_MODELS][0].id } })}
          >
            {Object.keys(LLM_MODELS).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            className={selectCls}
            value={config.llm.model}
            onChange={(e) => onConfig({ ...config, llm: { ...config.llm, model: e.target.value } })}
          >
            {LLM_MODELS[config.llm.provider].map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className={groupLabelCls}>TTS</label>
          <select
            className={selectCls}
            value={config.tts.provider}
            onChange={(e) => {
              const p = e.target.value as any
              onConfig({ ...config, tts: { provider: p, model: TTS_MODELS[p as keyof typeof TTS_MODELS][0].id, voice: TTS_VOICES[p as keyof typeof TTS_VOICES]?.[0] ?? '' } })
            }}
          >
            {Object.keys(TTS_MODELS).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            className={selectCls}
            value={config.tts.model}
            onChange={(e) => onConfig({ ...config, tts: { ...config.tts, model: e.target.value } })}
          >
            {TTS_MODELS[config.tts.provider as keyof typeof TTS_MODELS]?.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          {ttsVoices.length > 0 && (
            <select
              className={selectCls}
              value={config.tts.voice}
              onChange={(e) => onConfig({ ...config, tts: { ...config.tts, voice: e.target.value } })}
            >
              {ttsVoices.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
        </div>

        <div className="mb-3">
          <label className={groupLabelCls}>이미지 생성</label>
          <select
            className={selectCls}
            value={config.image.provider}
            onChange={(e) => {
              const p = e.target.value as any
              onConfig({ ...config, image: { provider: p, model: IMAGE_MODELS[p as keyof typeof IMAGE_MODELS][0].id } })
            }}
          >
            {Object.keys(IMAGE_MODELS).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            className={selectCls}
            value={config.image.model}
            onChange={(e) => onConfig({ ...config, image: { ...config.image, model: e.target.value } })}
          >
            {IMAGE_MODELS[config.image.provider as keyof typeof IMAGE_MODELS]?.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className={groupLabelCls}>앰비언트 오디오 출처</label>
          <select
            className={selectCls}
            value={config.audio.provider}
            onChange={(e) => onConfig({ ...config, audio: { provider: e.target.value as any } })}
          >
            <option value="freesound">Freesound ✓무료 (freesound.org)</option>
          </select>
        </div>
      </section>

      <section>
        <h3 className="text-gold-dim text-[12px] tracking-wider uppercase mb-3.5">API 테스트</h3>
        <ApiTest keys={keys} config={config} />
      </section>
    </div>
  )
}
