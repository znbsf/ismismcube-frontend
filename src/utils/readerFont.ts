export const READER_FONT_KEY = 'ismismcube.infoFontScale'
export const MIN_READER_SCALE = 0.7
export const MAX_READER_SCALE = 1.8

export function parseReaderScale(raw: string | null): number {
  if (raw === null || raw.trim() === '') return 1
  const scale = Number(raw)
  return Number.isFinite(scale) && scale >= MIN_READER_SCALE && scale <= MAX_READER_SCALE ? scale : 1
}

export function readReaderScale(storage: Pick<Storage, 'getItem'>): number {
  try { return parseReaderScale(storage.getItem(READER_FONT_KEY)) } catch { return 1 }
}

export function stepReaderScale(scale: number, direction: -1 | 1): number {
  return Math.min(MAX_READER_SCALE, Math.max(MIN_READER_SCALE, Math.round((scale + direction * 0.1) * 10) / 10))
}

function position(scale: number): number {
  return (Math.min(MAX_READER_SCALE, Math.max(MIN_READER_SCALE, scale)) - MIN_READER_SCALE) /
    (MAX_READER_SCALE - MIN_READER_SCALE)
}

/** Preserve desktop rem sizes; keep all reader steps useful on a small root. */
export function readerFontPixels(scale: number, rootPixels: number): number {
  const root = Number.isFinite(rootPixels) && rootPixels > 0 ? rootPixels : 16
  const min = Math.max(13, root * MIN_READER_SCALE)
  const max = Math.max(26, root * MAX_READER_SCALE)
  return min + position(scale) * (max - min)
}

export function readerFontCss(scale: number): string {
  const t = position(scale)
  return `calc(${1 - t} * max(13px, 0.7rem) + ${t} * max(26px, 1.8rem))`
}
