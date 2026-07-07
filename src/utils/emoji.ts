const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu

export function stripEmoji(text: string): string {
  return text.replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim()
}
