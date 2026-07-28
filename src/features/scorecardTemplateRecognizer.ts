import { Platform } from 'react-native'
import type { RecognizedScorecard } from './ocr'

export type ScorecardTemplateProvider = 'smartscore' | 'kakao' | 'unknown'

export type ScorecardTemplateRecognitionStatus =
  | 'unsupported-runtime'
  | 'ocr-adapter-missing'
  | 'template-not-detected'
  | 'recognized'

export type ScorecardTemplateRecognitionResult = {
  status: ScorecardTemplateRecognitionStatus
  provider: ScorecardTemplateProvider
  scorecard?: RecognizedScorecard
}

export type ScorecardTextBlock = {
  text: string
  x: number
  y: number
  width: number
  height: number
}

export type ScorecardTextRecognizer = (uri: string) => Promise<ScorecardTextBlock[]>

type TemplateDetector = {
  provider: ScorecardTemplateProvider
  matches: (blocks: ScorecardTextBlock[]) => boolean
  parse: (blocks: ScorecardTextBlock[]) => RecognizedScorecard | null
}

type TextRow = {
  y: number
  height: number
  blocks: ScorecardTextBlock[]
}

type ParsedNineHoleTable = {
  title?: string
  pars: (number | null)[]
  players: Array<{ name: string; diffs: (number | null)[] }>
}

let textRecognizer: ScorecardTextRecognizer | null = null

export function setScorecardTextRecognizer(recognizer: ScorecardTextRecognizer | null) {
  textRecognizer = recognizer
}

function recognitionItemToBlock(item: { text?: string; boundingBox?: { x: number; y: number; width: number; height: number } }): ScorecardTextBlock | null {
  const text = typeof item.text === 'string' ? item.text : ''
  const box = item.boundingBox
  if (!text.trim() || !box) return null
  return {
    text,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
  }
}

async function recognizeTextBlocksWithMlkit(uri: string): Promise<ScorecardTextBlock[]> {
  const mlkit = await import('expo-mlkit-ocr')
  if (!mlkit.isSupported()) return []

  const recognition = await mlkit.recognizeText(uri)
  return recognition.blocks.flatMap((block) => {
    const elements = block.lines.flatMap((line) => line.elements.map(recognitionItemToBlock))
    const lineBlocks = block.lines.map(recognitionItemToBlock)
    const blockFallback = recognitionItemToBlock(block)
    return [...elements, ...lineBlocks, blockFallback].filter((item): item is ScorecardTextBlock => item != null)
  })
}

function normalizedText(blocks: ScorecardTextBlock[]) {
  return blocks.map((block) => block.text).join(' ').toLowerCase()
}

function hasScorecardTableMarkers(blocks: ScorecardTextBlock[]) {
  const text = normalizedText(blocks)
  return /\bhole\b/.test(text) && /\bpar\b/.test(text) && /\btotal\b|\bt\b/.test(text)
}

function centerX(block: ScorecardTextBlock) {
  return block.x + block.width / 2
}

function centerY(block: ScorecardTextBlock) {
  return block.y + block.height / 2
}

function cleanText(value: string) {
  return value.trim().replace(/\u2212|\u2013|\u2014/g, '-')
}

function parseInteger(value: string): number | null {
  const text = cleanText(value).replace(/[^\d-]/g, '')
  if (!/^-?\d+$/.test(text)) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

function rowText(row: TextRow) {
  return row.blocks.map((block) => cleanText(block.text)).join(' ')
}

function groupRows(blocks: ScorecardTextBlock[]): TextRow[] {
  const validBlocks = blocks
    .filter((block) => cleanText(block.text).length > 0)
    .sort((a, b) => centerY(a) - centerY(b))

  const rows: TextRow[] = []
  for (const block of validBlocks) {
    const y = centerY(block)
    const threshold = Math.max(8, block.height * 0.75)
    const row = rows.find((item) => Math.abs(item.y - y) <= Math.max(threshold, item.height * 0.75))
    if (!row) {
      rows.push({ y, height: block.height, blocks: [block] })
      continue
    }
    const nextCount = row.blocks.length + 1
    row.y = (row.y * row.blocks.length + y) / nextCount
    row.height = Math.max(row.height, block.height)
    row.blocks.push(block)
  }

  return rows
    .map((row) => ({ ...row, blocks: row.blocks.sort((a, b) => centerX(a) - centerX(b)) }))
    .sort((a, b) => a.y - b.y)
}

function hasHoleHeader(row: TextRow) {
  const text = rowText(row).toLowerCase()
  const holeNumbers = row.blocks
    .map((block) => parseInteger(block.text))
    .filter((value): value is number => value != null && value >= 1 && value <= 9)

  return /\bhole\b/.test(text) && holeNumbers.length >= 5
}

function parseHeaderColumns(row: TextRow): number[] {
  const columns = row.blocks
    .map((block) => ({ x: centerX(block), value: parseInteger(block.text) }))
    .filter((item): item is { x: number; value: number } => item.value != null && item.value >= 1 && item.value <= 9)
    .sort((a, b) => a.x - b.x)

  const seen = new Set<number>()
  const uniqueColumns: number[] = []
  for (const column of columns) {
    if (seen.has(column.value)) continue
    seen.add(column.value)
    uniqueColumns.push(column.x)
  }

  return uniqueColumns.length >= 9 ? uniqueColumns.slice(0, 9) : []
}

function nearestNumberAtColumn(row: TextRow, columnX: number, tolerance: number): number | null {
  let best: { distance: number; value: number } | null = null
  for (const block of row.blocks) {
    const value = parseInteger(block.text)
    if (value == null) continue
    const distance = Math.abs(centerX(block) - columnX)
    if (distance > tolerance) continue
    if (!best || distance < best.distance) best = { distance, value }
  }
  return best?.value ?? null
}

function parsePlayerName(row: TextRow, firstScoreColumnX: number) {
  return row.blocks
    .filter((block) => centerX(block) < firstScoreColumnX)
    .map((block) => cleanText(block.text))
    .filter((text) => text && !/^(hole|par|total|t)$/i.test(text) && parseInteger(text) == null)
    .join(' ')
    .trim()
}

function parseNineHoleTable(rows: TextRow[], headerIndex: number, nextHeaderIndex: number): ParsedNineHoleTable | null {
  const headerRow = rows[headerIndex]
  const scoreColumns = parseHeaderColumns(headerRow)
  if (scoreColumns.length !== 9) return null

  const columnGap = scoreColumns.length > 1
    ? Math.min(...scoreColumns.slice(1).map((x, index) => x - scoreColumns[index]))
    : 36
  const tolerance = Math.max(14, columnGap * 0.45)
  const firstScoreColumnX = scoreColumns[0] - columnGap * 0.55
  const tableRows = rows.slice(headerIndex + 1, nextHeaderIndex)
  const parRowIndex = tableRows.findIndex((row) => /\bpar\b/i.test(rowText(row)))
  if (parRowIndex < 0) return null

  const parRow = tableRows[parRowIndex]
  const pars = scoreColumns.map((x) => nearestNumberAtColumn(parRow, x, tolerance))
  if (pars.filter((par) => par != null).length < 5) return null

  const title = headerIndex > 0 && !hasHoleHeader(rows[headerIndex - 1])
    ? rowText(rows[headerIndex - 1]).trim()
    : undefined

  const players = tableRows.slice(parRowIndex + 1).flatMap((row) => {
    const diffs = scoreColumns.map((x) => nearestNumberAtColumn(row, x, tolerance))
    const readableScores = diffs.filter((score) => score != null).length
    if (readableScores < 5) return []

    return [{
      name: parsePlayerName(row, firstScoreColumnX),
      diffs,
    }]
  })

  if (players.length === 0) return null
  return { title, pars, players }
}

function combineTables(tables: ParsedNineHoleTable[]): RecognizedScorecard | null {
  if (tables.length === 0) return null
  if (tables.length === 1) {
    return {
      pars: tables[0].pars,
      players: tables[0].players,
      recognizedCourseName: tables[0].title,
    }
  }

  const [front, back] = tables
  const maxPlayers = Math.max(front.players.length, back.players.length)
  const players = Array.from({ length: maxPlayers }, (_, index) => {
    const frontPlayer = front.players[index]
    const backPlayer = back.players[index]
    return {
      name: frontPlayer?.name || backPlayer?.name || '',
      diffs: [
        ...(frontPlayer?.diffs ?? Array.from({ length: 9 }, () => null)),
        ...(backPlayer?.diffs ?? Array.from({ length: 9 }, () => null)),
      ],
    }
  })

  return {
    pars: [...front.pars, ...back.pars],
    players,
    recognizedCourseName: [front.title, back.title].filter(Boolean).join(' / ') || undefined,
  }
}

export function parseScorecardTemplateBlocks(blocks: ScorecardTextBlock[]): RecognizedScorecard | null {
  const rows = groupRows(blocks)
  const headerIndexes = rows
    .map((row, index) => hasHoleHeader(row) ? index : -1)
    .filter((index) => index >= 0)

  const tables = headerIndexes
    .map((headerIndex, index) => parseNineHoleTable(rows, headerIndex, headerIndexes[index + 1] ?? rows.length))
    .filter((table): table is ParsedNineHoleTable => table != null)

  return combineTables(tables)
}

const TEMPLATE_DETECTORS: TemplateDetector[] = [
  {
    provider: 'smartscore',
    matches: (blocks) => /smartscore/.test(normalizedText(blocks)) || hasScorecardTableMarkers(blocks),
    parse: parseScorecardTemplateBlocks,
  },
  {
    provider: 'kakao',
    matches: (blocks) => /kakao|scorecard/.test(normalizedText(blocks)) && hasScorecardTableMarkers(blocks),
    parse: parseScorecardTemplateBlocks,
  },
]

export async function recognizeScorecardByTemplate(uri: string): Promise<ScorecardTemplateRecognitionResult> {
  const recognizer = textRecognizer ?? recognizeTextBlocksWithMlkit
  if (!recognizer) {
    return {
      status: Platform.OS === 'web' ? 'ocr-adapter-missing' : 'unsupported-runtime',
      provider: 'unknown',
    }
  }

  let blocks: ScorecardTextBlock[]
  try {
    blocks = await recognizer(uri)
  } catch {
    return {
      status: Platform.OS === 'web' ? 'ocr-adapter-missing' : 'unsupported-runtime',
      provider: 'unknown',
    }
  }
  if (blocks.length === 0) {
    return {
      status: Platform.OS === 'web' ? 'ocr-adapter-missing' : 'unsupported-runtime',
      provider: 'unknown',
    }
  }

  const detector = TEMPLATE_DETECTORS.find((item) => item.matches(blocks))
  if (!detector) {
    return { status: 'template-not-detected', provider: 'unknown' }
  }

  const scorecard = detector.parse(blocks)
  if (!scorecard) {
    return { status: 'ocr-adapter-missing', provider: detector.provider }
  }

  return { status: 'recognized', provider: detector.provider, scorecard }
}
