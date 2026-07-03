import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { FFMPEG_CORE_BASE } from '../config/endpoints'

export const SECONDS_PER_IMAGE = 7
const FADE_DURATION = 1
const OUT_W = 1024
const OUT_H = 576
const OUT_FPS = 24
const WORK_W = OUT_W * 1.5
const WORK_H = OUT_H * 1.5
const ZOOM_MAX = 1.15

// Ken Burns 효과 pool — 배열 셔플 후 pop, 소진되면 재충전 (shuffle bag)
const EFFECTS = [
  'zoom-in', 'zoom-out',
  'pan-left-right', 'pan-right-left',
  'pan-top-bottom', 'pan-bottom-top',
  'diagonal',
] as const
type Effect = typeof EFFECTS[number]

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function makeEffectPicker(): () => Effect {
  let bag: Effect[] = []
  return () => {
    if (bag.length === 0) bag = shuffle(EFFECTS)
    return bag.pop()!
  }
}

// t: 클립 내 진행률 0→1 (on = zoompan 출력 프레임 번호)
function zoompanFilter(effect: Effect, frames: number): string {
  const t = `(on/${Math.max(frames - 1, 1)})`
  const cx = 'iw/2-(iw/zoom/2)'
  const cy = 'ih/2-(ih/zoom/2)'
  switch (effect) {
    case 'zoom-in':
      return `z='1+${ZOOM_MAX - 1}*${t}':x='${cx}':y='${cy}'`
    case 'zoom-out':
      return `z='${ZOOM_MAX}-${ZOOM_MAX - 1}*${t}':x='${cx}':y='${cy}'`
    case 'pan-left-right':
      return `z=${ZOOM_MAX}:x='${t}*(iw-iw/zoom)':y='${cy}'`
    case 'pan-right-left':
      return `z=${ZOOM_MAX}:x='(1-${t})*(iw-iw/zoom)':y='${cy}'`
    case 'pan-top-bottom':
      return `z=${ZOOM_MAX}:x='${cx}':y='${t}*(ih-ih/zoom)'`
    case 'pan-bottom-top':
      return `z=${ZOOM_MAX}:x='${cx}':y='(1-${t})*(ih-ih/zoom)'`
    case 'diagonal':
      return `z='1+${ZOOM_MAX - 1}*${t}':x='${t}*(iw-iw/zoom)':y='${t}*(ih-ih/zoom)'`
  }
}

function kenBurnsVF(effect: Effect, frames: number): string {
  return [
    `scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=increase`,
    `crop=${OUT_W}:${OUT_H}`,
    `scale=${WORK_W}:${WORK_H}`,
    `zoompan=${zoompanFilter(effect, frames)}:d=1:s=${OUT_W}x${OUT_H}:fps=${OUT_FPS}`,
    'setsar=1',
  ].join(',')
}

export function computeImageCount(ttsDuration: number, secondsPerImage: number = SECONDS_PER_IMAGE): number {
  const total = ttsDuration + 2
  return Math.max(1, Math.ceil(total / secondsPerImage))
}

function extOf(blob: Blob): string {
  if (blob.type.includes('webm')) return 'webm'
  if (blob.type.includes('ogg')) return 'ogg'
  if (blob.type.includes('wav')) return 'wav'
  if (blob.type.includes('mp3') || blob.type.includes('mpeg')) return 'mp3'
  return 'mp4'
}

function imgExtOf(blob: Blob): string {
  if (blob.type.includes('jpeg') || blob.type.includes('jpg')) return 'jpg'
  if (blob.type.includes('webp')) return 'webp'
  return 'png'
}

export interface CaptionOptions {
  text: string
  bgColor: string
  textColor: string
}

// 10자 초과 또는 5단어 단위로 자막을 끊는다.
export function splitCaptionChunks(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let current: string[] = []
  for (const word of words) {
    current.push(word)
    const joined = current.join(' ')
    if (current.length >= 5 || joined.length > 10) {
      chunks.push(joined)
      current = []
    }
  }
  if (current.length) chunks.push(current.join(' '))
  return chunks
}

// 각 자막 청크에 글자 수 비례 시간 구간을 배정 (0..total)
function captionTimeRanges(chunks: string[], total: number): { start: number; end: number }[] {
  const lengths = chunks.map((c) => c.length)
  const sum = lengths.reduce((a, b) => a + b, 0) || 1
  const ranges: { start: number; end: number }[] = []
  let t = 0
  for (const len of lengths) {
    const dur = (len / sum) * total
    ranges.push({ start: t, end: t + dur })
    t += dur
  }
  return ranges
}

// 자막 청크 하나를 영상 프레임 크기의 투명 PNG로 렌더링. 자막 하단이 영상 하단으로부터 10% 위치에 오도록 배치.
function renderCaptionPNG(text: string, bgColor: string, textColor: string): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = OUT_W
    canvas.height = OUT_H
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, OUT_W, OUT_H)

    const fontSize = 34
    ctx.font = `600 ${fontSize}px "Malgun Gothic", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const paddingX = 24
    const paddingY = 14
    const boxW = ctx.measureText(text).width + paddingX * 2
    const boxH = fontSize + paddingY * 2
    const boxBottom = OUT_H * 0.9
    const boxTop = boxBottom - boxH
    const boxX = (OUT_W - boxW) / 2

    ctx.fillStyle = bgColor
    ctx.fillRect(boxX, boxTop, boxW, boxH)
    ctx.fillStyle = textColor
    ctx.fillText(text, OUT_W / 2, boxTop + boxH / 2)

    canvas.toBlob((blob) => resolve(blob!), 'image/png')
  })
}

export async function composeVideo(
  imageBlobs: Blob[],
  ttsBlob: Blob,
  ambientBlob: Blob | null,
  ttsDuration: number,
  onProgress?: (p: number) => void,
  onMessage?: (msg: string) => void,
  caption?: CaptionOptions | null
): Promise<Blob> {
  onMessage?.('ffmpeg.wasm 로드 중...')
  const ff = new FFmpeg()
  ff.on('progress', ({ progress }: { progress: number }) => onProgress?.(Math.min(100, Math.max(0, Math.round(progress * 100)))))
  await ff.load({
    coreURL: `${FFMPEG_CORE_BASE}/ffmpeg-core.js`,
    wasmURL: `${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`,
  })

  const total = ttsDuration + 2
  const n = imageBlobs.length
  const ttsExt = extOf(ttsBlob)
  const srcTts = `tts.${ttsExt}`

  // per-image visible duration: split total runtime evenly across all images
  const segDur: number[] = new Array(n).fill(total / n)
  const fade = n > 1 ? Math.min(FADE_DURATION, segDur[0] / 2, segDur[n - 1] / 2) : 0

  onMessage?.('파일 기록 중...')
  await ff.writeFile(srcTts, await fetchFile(ttsBlob))
  if (ambientBlob) await ff.writeFile('ambient.mp3', await fetchFile(ambientBlob))

  // Step 1: turn each still image into a clip of its visible duration,
  // with a randomly assigned Ken Burns zoom/pan effect (last clip padded
  // so transitions don't shorten total runtime)
  const nextEffect = makeEffectPicker()
  for (let i = 0; i < n; i++) {
    onMessage?.(`이미지 ${i + 1}/${n} 클립 생성...`)
    const imgExt = imgExtOf(imageBlobs[i])
    const srcImg = `src_image${i}.${imgExt}`
    await ff.writeFile(srcImg, await fetchFile(imageBlobs[i]))
    const clipDur = i === n - 1 ? segDur[i] + (n - 1) * fade : segDur[i]
    const frames = Math.max(1, Math.round(clipDur * OUT_FPS))
    await ff.exec([
      '-y',
      '-loop', '1',
      '-i', srcImg,
      '-t', String(clipDur),
      '-r', String(OUT_FPS),
      '-vf', kenBurnsVF(nextEffect(), frames),
      '-c:v', 'libx264', '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      `clip${i}.mp4`,
    ])
  }

  // Step 2: crossfade the clips together
  let videoFile = 'clip0.mp4'
  if (n > 1) {
    onMessage?.('이미지 전환 합성...')
    const inputArgs: string[] = []
    for (let i = 0; i < n; i++) inputArgs.push('-i', `clip${i}.mp4`)

    let filter = ''
    let prevLabel = '0:v'
    let running = segDur[0]
    for (let i = 1; i < n; i++) {
      const offset = running - fade
      const outLabel = i === n - 1 ? 'vout' : `v${i}`
      filter += `[${prevLabel}][${i}:v]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(2)}[${outLabel}];`
      prevLabel = outLabel
      running = running + segDur[i] - fade
    }
    filter = filter.slice(0, -1)

    await ff.exec([
      '-y', ...inputArgs,
      '-filter_complex', filter,
      '-map', '[vout]',
      '-r', '24',
      '-c:v', 'libx264', '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      'looped.mp4',
    ])
    videoFile = 'looped.mp4'
  }

  // Step 2.5: burn in captions, timed proportionally across the total runtime
  const captionChunks = caption ? splitCaptionChunks(caption.text) : []
  if (caption && captionChunks.length) {
    onMessage?.('자막 합성...')
    const ranges = captionTimeRanges(captionChunks, total)
    const inputArgs: string[] = ['-i', videoFile]
    for (let i = 0; i < captionChunks.length; i++) {
      const png = await renderCaptionPNG(captionChunks[i], caption.bgColor, caption.textColor)
      await ff.writeFile(`caption${i}.png`, await fetchFile(png))
      inputArgs.push('-i', `caption${i}.png`)
    }

    let filter = ''
    let prevLabel = '0:v'
    for (let i = 0; i < captionChunks.length; i++) {
      const outLabel = i === captionChunks.length - 1 ? 'vcap' : `vc${i}`
      filter += `[${prevLabel}][${i + 1}:v]overlay=0:0:enable='between(t,${ranges[i].start.toFixed(2)},${ranges[i].end.toFixed(2)})'[${outLabel}];`
      prevLabel = outLabel
    }
    filter = filter.slice(0, -1)

    await ff.exec([
      '-y', ...inputArgs,
      '-filter_complex', filter,
      '-map', '[vcap]',
      '-r', String(OUT_FPS),
      '-c:v', 'libx264', '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      'captioned.mp4',
    ])
    videoFile = 'captioned.mp4'
  }

  // Step 3: build audio mix
  onMessage?.('오디오 믹싱...')
  if (ambientBlob) {
    await ff.exec([
      '-y',
      '-i', srcTts,
      '-stream_loop', '-1',
      '-i', 'ambient.mp3',
      '-filter_complex',
      `[0:a]adelay=1000:all=1[a1];[1:a]volume=2.0,atrim=duration=${total}[a2];[a1][a2]amix=inputs=2:duration=first[aout]`,
      '-map', '[aout]',
      '-t', String(total),
      'mixed.mp3',
    ])
  } else {
    await ff.exec([
      '-y',
      '-i', srcTts,
      '-filter_complex', '[0:a]adelay=1000:all=1[aout]',
      '-map', '[aout]',
      '-t', String(total),
      'mixed.mp3',
    ])
  }

  // Step 4: mux video + audio → mp4
  onMessage?.('최종 인코딩...')
  await ff.exec([
    '-y',
    '-i', videoFile,
    '-i', 'mixed.mp3',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-map', '0:v',
    '-map', '1:a',
    '-t', String(total),
    '-movflags', '+faststart',
    'output.mp4',
  ])

  const data = await ff.readFile('output.mp4') as Uint8Array
  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  return new Blob([copy], { type: 'video/mp4' })
}
