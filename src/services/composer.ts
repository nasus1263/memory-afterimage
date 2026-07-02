import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { FFMPEG_CORE_BASE } from '../config/endpoints'

export const SECONDS_PER_IMAGE = 7
const FADE_DURATION = 1
const SCALE_VF = 'scale=1024:576:force_original_aspect_ratio=decrease,pad=1024:576:(ow-iw)/2:(oh-ih)/2,setsar=1'

export function computeImageCount(ttsDuration: number): number {
  const total = ttsDuration + 2
  return Math.max(1, Math.ceil(total / SECONDS_PER_IMAGE))
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

export async function composeVideo(
  imageBlobs: Blob[],
  ttsBlob: Blob,
  ambientBlob: Blob | null,
  ttsDuration: number,
  onProgress?: (p: number) => void,
  onMessage?: (msg: string) => void
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

  // per-image visible duration: fixed n seconds each, remainder on the last image
  const segDur: number[] = []
  for (let i = 0; i < n - 1; i++) segDur.push(SECONDS_PER_IMAGE)
  segDur.push(total - SECONDS_PER_IMAGE * (n - 1))
  const fade = n > 1 ? Math.min(FADE_DURATION, segDur[0] / 2, segDur[n - 1] / 2) : 0

  onMessage?.('파일 기록 중...')
  await ff.writeFile(srcTts, await fetchFile(ttsBlob))
  if (ambientBlob) await ff.writeFile('ambient.mp3', await fetchFile(ambientBlob))

  // Step 1: turn each still image into a clip of its visible duration
  // (the last clip is padded so transitions don't shorten total runtime)
  for (let i = 0; i < n; i++) {
    onMessage?.(`이미지 ${i + 1}/${n} 클립 생성...`)
    const imgExt = imgExtOf(imageBlobs[i])
    const srcImg = `src_image${i}.${imgExt}`
    await ff.writeFile(srcImg, await fetchFile(imageBlobs[i]))
    const clipDur = i === n - 1 ? segDur[i] + (n - 1) * fade : segDur[i]
    await ff.exec([
      '-y',
      '-loop', '1',
      '-i', srcImg,
      '-t', String(clipDur),
      '-r', '24',
      '-vf', SCALE_VF,
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

  // Step 3: build audio mix
  onMessage?.('오디오 믹싱...')
  if (ambientBlob) {
    await ff.exec([
      '-y',
      '-i', srcTts,
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
