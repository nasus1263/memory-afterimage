import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { FFMPEG_CORE_BASE } from '../config/endpoints'

function extOf(blob: Blob): string {
  if (blob.type.includes('webm')) return 'webm'
  if (blob.type.includes('ogg')) return 'ogg'
  if (blob.type.includes('wav')) return 'wav'
  if (blob.type.includes('mp3') || blob.type.includes('mpeg')) return 'mp3'
  return 'mp4'
}

export async function composeVideo(
  videoBlob: Blob,
  ttsBlob: Blob,
  ambientBlob: Blob | null,
  ttsDuration: number,
  onProgress?: (p: number) => void,
  onMessage?: (msg: string) => void
): Promise<Blob> {
  onMessage?.('ffmpeg.wasm 로드 중...')
  const ff = new FFmpeg()
  ff.on('progress', ({ progress }: { progress: number }) => onProgress?.(Math.round(progress * 100)))
  await ff.load({
    coreURL: `${FFMPEG_CORE_BASE}/ffmpeg-core.js`,
    wasmURL: `${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`,
  })

  const total = ttsDuration + 2
  const vidExt = extOf(videoBlob)
  const ttsExt = extOf(ttsBlob)
  const srcVid = `src_video.${vidExt}`
  const srcTts = `tts.${ttsExt}`

  onMessage?.('파일 기록 중...')
  await ff.writeFile(srcVid, await fetchFile(videoBlob))
  await ff.writeFile(srcTts, await fetchFile(ttsBlob))
  if (ambientBlob) await ff.writeFile('ambient.mp3', await fetchFile(ambientBlob))

  // Step 1: loop source video — use large finite count so -t can cut it cleanly
  onMessage?.('비디오 루프 생성...')
  await ff.exec([
    '-y',
    '-stream_loop', '99',
    '-i', srcVid,
    '-t', String(total),
    '-c:v', 'libx264', '-preset', 'ultrafast',
    '-an',
    'looped.mp4',
  ])

  // Step 2: build audio mix
  onMessage?.('오디오 믹싱...')
  if (ambientBlob) {
    await ff.exec([
      '-y',
      '-i', srcTts,
      '-i', 'ambient.mp3',
      '-filter_complex',
      `[0:a]adelay=1000:all=1[a1];[1:a]volume=0.25,atrim=duration=${total}[a2];[a1][a2]amix=inputs=2:duration=first[aout]`,
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

  // Step 3: mux video + audio → mp4
  onMessage?.('최종 인코딩...')
  await ff.exec([
    '-y',
    '-i', 'looped.mp4',
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
