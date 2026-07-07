// 즉석 보이스 클로닝용 세션 참조 홀더.
//
// GPT-SoVITS 합성은 "참조 오디오(사용자가 방금 말한 목소리) + 그 오디오의 실제 대사"가
// 필요하다. 이 값은 /input 에서 캡처되어 /chat → /process(Pipeline의 generateTTS)까지
// 살아있어야 한다. blob 은 JSON 직렬화가 어려워 localStorage(progress)에 못 넣으므로,
// SPA 세션 동안만 유지되는 module-level 홀더에 보관한다.
//
// 페이지 새로고침으로 세션이 끊기면 참조는 사라지고, TTS 는 endpoints.ts 의 고정 참조로
// 자연스럽게 폴백한다(graceful degradation). 즉 "잘 되면 방금 목소리, 안 되면 고정 목소리".

export interface VoiceRef {
  blob: Blob
  // 참조 오디오에서 실제로 말한 문장(STT 결과). GPT-SoVITS prompt_text 로 그대로 쓴다.
  text: string
}

let current: VoiceRef | null = null

export function setVoiceRef(ref: VoiceRef | null): void {
  current = ref
}

export function getVoiceRef(): VoiceRef | null {
  return current
}

export function clearVoiceRef(): void {
  current = null
}
