import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null

async function getFFmpeg(onProgress?: (p: number) => void): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg
  ffmpeg = new FFmpeg()
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }: { progress: number }) => onProgress(Math.round(progress * 100)))
  }
  await ffmpeg.load({
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
  })
  return ffmpeg
}

export async function composeVideo(
  videoBlob: Blob,
  ttsBlob: Blob,
  ambientBlob: Blob | null,
  ttsDuration: number,
  onProgress?: (p: number) => void
): Promise<Blob> {
  const ff = await getFFmpeg(onProgress)
  const total = ttsDuration + 2

  ff.writeFile('src_video.mp4', await fetchFile(videoBlob))
  ff.writeFile('tts.mp3', await fetchFile(ttsBlob))
  if (ambientBlob) ff.writeFile('ambient.mp3', await fetchFile(ambientBlob))

  // Step 1: loop source video to total duration
  await ff.exec([
    '-stream_loop', '-1',
    '-i', 'src_video.mp4',
    '-t', String(total),
    '-c:v', 'libx264', '-an',
    'looped.mp4',
  ])

  // Step 2: build audio mix
  if (ambientBlob) {
    await ff.exec([
      '-i', 'tts.mp3',
      '-i', 'ambient.mp3',
      '-filter_complex',
      `[0:a]adelay=1000:all=1[a1];[1:a]volume=0.25,atrim=duration=${total}[a2];[a1][a2]amix=inputs=2:duration=first[aout]`,
      '-map', '[aout]',
      '-t', String(total),
      'mixed.mp3',
    ])
  } else {
    await ff.exec([
      '-i', 'tts.mp3',
      '-filter_complex', '[0:a]adelay=1000:all=1[aout]',
      '-map', '[aout]',
      '-t', String(total),
      'mixed.mp3',
    ])
  }

  // Step 3: mux video + audio → mp4
  await ff.exec([
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
