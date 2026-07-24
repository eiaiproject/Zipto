import { jsPDF } from 'jspdf'

const FONT = 'helvetica'
const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 20
const BODY_W = PAGE_W - MARGIN * 2
const LINE_H = 5.2

type Block =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'body'; text: string; indent?: number }
  | { type: 'bullet'; text: string; indent?: number }
  | { type: 'numbered'; text: string; number: number; indent?: number }
  | { type: 'code'; text: string; lang?: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' }

interface TextStyle {
  bold?: boolean
  italic?: boolean
  code?: boolean
}

type InlineSeg = { text: string; styles: TextStyle }

// ── Inline parsing --------------------------------------------------------

interface MarkerDef {
  open: string
  close: string
  styles: TextStyle
}

const INLINE_MARKERS: MarkerDef[] = [
  { open: '`', close: '`', styles: { code: true } },
  { open: '***', close: '***', styles: { bold: true, italic: true } },
  { open: '___', close: '___', styles: { bold: true, italic: true } },
  { open: '**', close: '**', styles: { bold: true } },
  { open: '__', close: '__', styles: { bold: true } },
  { open: '*', close: '*', styles: { italic: true } },
  { open: '_', close: '_', styles: { italic: true } },
]

function findInlineMatch(remaining: string): { prefix: string; content: string; styles: TextStyle; rest: string } | null {
  for (const { open, close, styles } of INLINE_MARKERS) {
    const openIdx = remaining.indexOf(open)
    if (openIdx === -1) continue
    const contentStart = openIdx + open.length
    const closeIdx = remaining.indexOf(close, contentStart)
    if (closeIdx === -1) continue
    const content = remaining.slice(contentStart, closeIdx)
    if (content.length === 0) continue
    return {
      prefix: remaining.slice(0, openIdx),
      content,
      styles,
      rest: remaining.slice(closeIdx + close.length),
    }
  }
  return null
}

function parseInline(text: string): InlineSeg[] {
  const segments: InlineSeg[] = []
  let remaining = text

  while (remaining.length > 0) {
    const matched = findInlineMatch(remaining)
    if (matched) {
      if (matched.prefix) segments.push({ text: matched.prefix, styles: {} })
      segments.push({ text: matched.content, styles: matched.styles })
      remaining = matched.rest
    } else {
      segments.push({ text: remaining, styles: {} })
      break
    }
  }

  return segments
}

// ── Block parsing helpers -------------------------------------------------

const TABLE_LINE_RE = /^\|[^|]+\|$/
const BULLET_RE = /^[-*]\s+(.*)/
const NUMBERED_RE = /^(\d+)\.\s+(.*)/

function tryCodeBlock(lines: string[], i: number): { block: Block | null; nextI: number } {
  const trimmed = lines[i].trim()
  if (!trimmed.startsWith('```')) return { block: null, nextI: i }

  const lang = trimmed.slice(3).trim() || ''
  const codeLines: string[] = []
  let j = i + 1
  while (j < lines.length && !lines[j].trim().startsWith('```')) {
    codeLines.push(lines[j])
    j++
  }
  return { block: { type: 'code', text: codeLines.join('\n'), lang }, nextI: j + 1 }
}

function tryTableBlock(lines: string[], i: number): { block: Block | null; nextI: number } {
  if (!TABLE_LINE_RE.exec(lines[i].trim())) return { block: null, nextI: i }

  const tableLines: string[] = []
  let j = i
  while (j < lines.length && TABLE_LINE_RE.exec(lines[j].trim())) {
    tableLines.push(lines[j].trim())
    j++
  }
  const dataLines = tableLines.filter(l => !/^[\s|:-]+$/.exec(l))
  const rows = dataLines.map(l =>
    l.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1),
  )
  if (rows.length === 0 || rows[0].length === 0) return { block: null, nextI: i }
  return { block: { type: 'table', rows }, nextI: j }
}

function tryBlockquoteBlock(lines: string[], i: number): { block: Block | null; nextI: number } {
  if (!lines[i].trim().startsWith('> ')) return { block: null, nextI: i }

  const quoteLines: string[] = []
  let j = i
  while (j < lines.length && lines[j].trim().startsWith('> ')) {
    quoteLines.push(lines[j].trim().slice(2))
    j++
  }
  return { block: { type: 'blockquote', text: quoteLines.join(' ') }, nextI: j }
}

function tryHeadingBlock(trimmed: string): Block | null {
  if (trimmed.startsWith('# ')) return { type: 'h1', text: trimmed.slice(2) }
  if (trimmed.startsWith('## ')) return { type: 'h2', text: trimmed.slice(3) }
  if (trimmed.startsWith('### ')) return { type: 'h3', text: trimmed.slice(4) }
  return null
}

function tryListBlock(trimmed: string): Block | null {
  const bulletExec = BULLET_RE.exec(trimmed)
  if (bulletExec) return { type: 'bullet', text: bulletExec[1], indent: 10 }

  const numberedExec = NUMBERED_RE.exec(trimmed)
  if (numberedExec) {
    return {
      type: 'numbered',
      text: numberedExec[2],
      number: Number.parseInt(numberedExec[1], 10),
      indent: 10,
    }
  }
  return null
}

function tryHrBlock(trimmed: string): Block | null {
  if (trimmed === '---' || trimmed === '***' || trimmed === '___') return { type: 'hr' }
  return null
}

// ── Block parsing ---------------------------------------------------------

function parseBlocks(md: string): Block[] {
  const blocks: Block[] = []
  const lines = md.split('\n')
  let i = 0

  while (i < lines.length) {
    const raw = lines[i]
    const trimmed = raw.trim()

    const codeResult = tryCodeBlock(lines, i)
    if (codeResult.block) { blocks.push(codeResult.block); i = codeResult.nextI; continue }

    const tableResult = tryTableBlock(lines, i)
    if (tableResult.block) { blocks.push(tableResult.block); i = tableResult.nextI; continue }

    if (!trimmed) { i++; continue }

    const heading = tryHeadingBlock(trimmed)
    if (heading) { blocks.push(heading); i++; continue }

    const quoteResult = tryBlockquoteBlock(lines, i)
    if (quoteResult.block) { blocks.push(quoteResult.block); i = quoteResult.nextI; continue }

    const hr = tryHrBlock(trimmed)
    if (hr) { blocks.push(hr); i++; continue }

    const list = tryListBlock(trimmed)
    if (list) { blocks.push(list); i++; continue }

    blocks.push({ type: 'body', text: raw })
    i++
  }

  return blocks
}

// ── PDF rendering helpers -------------------------------------------------

function applyStyle(doc: jsPDF, styles: TextStyle): void {
  if (styles.code) {
    doc.setFont('courier', 'normal')
    doc.setFontSize(8)
  } else {
    let face: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal'
    if (styles.bold && styles.italic) face = 'bolditalic'
    else if (styles.bold) face = 'bold'
    else if (styles.italic) face = 'italic'
    doc.setFont(FONT, face)
    doc.setFontSize(9)
  }
}

function splitWords(text: string): string[] {
  const parts: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    const nonWs = /^\S+/.exec(remaining)
    if (nonWs) { parts.push(nonWs[0]); remaining = remaining.slice(nonWs[0].length); continue }
    const ws = /^\s+/.exec(remaining)
    if (ws) { parts.push(ws[0]); remaining = remaining.slice(ws[0].length); continue }
    break
  }
  return parts
}

/**
 * Render inline text with mixed styles (bold, italic, code) using word-level
 * wrapping. Returns the number of lines consumed and the total height used.
 *
 * After calling this, the font is reset to helvetica/normal/9px so callers
 * don't need to worry about stale font state.
 */
function writeInlineText(
  doc: jsPDF,
  segments: InlineSeg[],
  x: number,
  y: number,
  maxWidth: number,
): { lines: number; height: number } {
  if (segments.length === 0) return { lines: 0, height: 0 }

  // Fast path: single plain-text segment → use splitTextToSize
  if (segments.length === 1 && !segments[0].styles.bold && !segments[0].styles.italic && !segments[0].styles.code) {
    doc.setFont(FONT, 'normal')
    doc.setFontSize(9)
    const splitLines = doc.splitTextToSize(segments[0].text, maxWidth) as string[]
    doc.text(splitLines, x, y)
    return { lines: splitLines.length, height: splitLines.length * LINE_H }
  }

  // Mixed styles: word-level wrapping
  interface Token {
    text: string
    styles: TextStyle
  }
  const tokens: Token[] = []
  for (const seg of segments) {
    for (const part of splitWords(seg.text)) {
      tokens.push({ text: part, styles: seg.styles })
    }
  }


  let currentX = x
  let currentY = y
  let lineCount = 1

  for (const token of tokens) {
    applyStyle(doc, token.styles)
    const tw = doc.getTextWidth(token.text)
    const isWhitespace = token.text.trim().length === 0

    if (currentX > x && currentX + tw > x + maxWidth) {
      currentY += LINE_H
      currentX = x
      lineCount++
      if (isWhitespace) continue
    }

    doc.text(token.text, currentX, currentY)
    currentX += tw
  }

  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)

  return { lines: lineCount, height: lineCount * LINE_H }
}

function estimateLines(doc: jsPDF, text: string, maxWidth: number): number {
  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  return (doc.splitTextToSize(text, maxWidth) as string[]).length
}

// ── Table drawing ---------------------------------------------------------

function computeRowHeights(
  doc: jsPDF,
  rows: string[][],
  colCount: number,
  colWidth: number,
  padX: number,
): number[] {
  const heights: number[] = []
  for (let r = 0; r < rows.length; r++) {
    let maxCellLines = 1
    for (let c = 0; c < colCount; c++) {
      doc.setFont(FONT, r === 0 ? 'bold' : 'normal')
      doc.setFontSize(r === 0 ? 8 : 7.5)
      const cellLines = (doc.splitTextToSize(rows[r][c] || '', colWidth - padX * 2) as string[]).length
      maxCellLines = Math.max(maxCellLines, cellLines)
    }
    const baseH = r === 0 ? 7 : 5.5
    heights.push(baseH + (maxCellLines - 1) * 4)
  }
  return heights
}

function drawHeaderRow(
  doc: jsPDF,
  rows: string[][],
  colCount: number,
  colWidth: number,
  padX: number,
  x: number,
  y: number,
): void {
  doc.setFillColor(60, 50, 40)
  doc.setTextColor(255, 255, 255)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(8)
  for (let c = 0; c < colCount; c++) {
    const cellText = doc.splitTextToSize(rows[0][c] || '', colWidth - padX * 2) as string[]
    doc.text(cellText, x + c * colWidth + padX, y + 1.5 + 2.5)
  }
}

function drawDataCell(
  doc: jsPDF,
  row: string[],
  colCount: number,
  colWidth: number,
  padX: number,
  x: number,
  y: number,
): void {
  doc.setFont(FONT, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(60, 50, 40)
  for (let c = 0; c < colCount; c++) {
    const cellText = doc.splitTextToSize(row[c] || '', colWidth - padX * 2) as string[]
    doc.text(cellText, x + c * colWidth + padX, y + 1.5 + 2)
  }
}

function ensureSpace(doc: jsPDF, currentY: number, needed: number): number {
  if (currentY + needed > PAGE_H - MARGIN) {
    doc.addPage()
    return MARGIN
  }
  return currentY
}

function drawTableRow(
  doc: jsPDF,
  rows: string[][],
  r: number,
  rowH: number,
  x: number,
  currentY: number,
  tableWidth: number,
): number {
  const colCount = rows[0].length
  const colWidth = tableWidth / colCount
  const padX = 1.5
  currentY = ensureSpace(doc, currentY, rowH)

  if (r % 2 === 0) {
    doc.setFillColor(248, 245, 240)
    doc.rect(x, currentY, tableWidth, rowH, 'F')
  }

  doc.setDrawColor(200, 190, 180)
  doc.rect(x, currentY, tableWidth, rowH)

  drawDataCell(doc, rows[r], colCount, colWidth, padX, x, currentY)
  return currentY + rowH
}

function drawTable(doc: jsPDF, rows: string[][], x: number, y: number, tableMaxWidth: number): number {
  if (rows.length === 0) return 0

  const colCount = rows[0].length
  if (colCount === 0) return 0

  const colWidth = tableMaxWidth / colCount
  const padX = 1.5
  let currentY = y

  const rowHeights = computeRowHeights(doc, rows, colCount, colWidth, padX)

  const totalH = rowHeights.reduce((a, b) => a + b, 0)
  currentY = ensureSpace(doc, currentY, totalH)

  // Header row
  doc.setFillColor(60, 50, 40)
  doc.rect(x, currentY, tableMaxWidth, rowHeights[0], 'F')
  drawHeaderRow(doc, rows, colCount, colWidth, padX, x, currentY)
  currentY += rowHeights[0]

  // Data rows
  for (let r = 1; r < rows.length; r++) {
    currentY = drawTableRow(doc, rows, r, rowHeights[r], x, currentY, tableMaxWidth)
  }

  doc.setTextColor(0, 0, 0)
  return currentY - y + 2
}

// ── Block renderers -------------------------------------------------------

function renderHeading(
  doc: jsPDF, text: string, checkSpace: (n: number) => void,
  yRef: { value: number },
  opts: { size: number; color: [number, number, number]; lineH: number; gap: number },
): void {
  checkSpace(opts.size + 4)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(opts.size)
  doc.setTextColor(opts.color[0], opts.color[1], opts.color[2])
  const lines = doc.splitTextToSize(text, BODY_W) as string[]
  doc.text(lines, MARGIN, yRef.value)
  yRef.value += lines.length * opts.lineH + opts.gap
  doc.setTextColor(0, 0, 0)
}

function renderBlockquote(
  doc: jsPDF, text: string, checkSpace: (n: number) => void,
  yRef: { value: number },
): void {
  const segments = parseInline(text)
  const fullText = segments.map(s => s.text).join('')
  const estimatedLines = estimateLines(doc, fullText, BODY_W - 12)
  const contentH = Math.max(estimatedLines * LINE_H, LINE_H)
  const blockH = contentH + 10

  checkSpace(blockH)

  doc.setDrawColor(180, 160, 140)
  doc.setLineWidth(0.8)
  doc.line(MARGIN, yRef.value, MARGIN, yRef.value + contentH)

  doc.setFillColor(250, 248, 245)
  doc.rect(MARGIN + 2, yRef.value + 1, BODY_W - 4, contentH, 'F')

  const { height: actualHeight } = writeInlineText(doc, segments, MARGIN + 6, yRef.value + 4, BODY_W - 12)
  yRef.value += Math.max(blockH, actualHeight)
}

function renderListBlock(
  doc: jsPDF, text: string, indent: number, checkSpace: (n: number) => void,
  yRef: { value: number },
  marker: string, markerOffset: number,
): void {
  checkSpace(LINE_H)
  const xPos = MARGIN + indent
  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  doc.text(marker, xPos + markerOffset, yRef.value)
  const segments = parseInline(text)
  const { height } = writeInlineText(doc, segments, xPos, yRef.value, BODY_W - indent)
  yRef.value += height + 1
}

function renderCodeBlock(
  doc: jsPDF, codeText: string, lang: string | undefined, checkSpace: (n: number) => void,
  yRef: { value: number },
): void {
  doc.setFont('courier', 'normal')
  doc.setFontSize(7.5)
  const codeLines = codeText.split('\n').flatMap(l => doc.splitTextToSize(l, BODY_W - 10) as string[])
  const codeH = codeLines.length * 4 + 8

  checkSpace(codeH)

  doc.setFillColor(242, 238, 233)
  doc.rect(MARGIN, yRef.value - 3, BODY_W, codeH, 'F')
  doc.setDrawColor(200, 185, 170)
  doc.rect(MARGIN, yRef.value - 3, BODY_W, codeH)

  if (lang) {
    doc.setFont(FONT, 'italic')
    doc.setFontSize(7)
    doc.setTextColor(120, 110, 100)
    doc.text(lang, MARGIN + 4, yRef.value - 1)
    doc.setTextColor(0, 0, 0)
  }

  doc.setFont('courier', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(50, 45, 40)
  doc.text(codeLines, MARGIN + 5, yRef.value + 4)
  doc.setTextColor(0, 0, 0)

  yRef.value += codeH + 4
}

function renderHr(
  doc: jsPDF, checkSpace: (n: number) => void,
  yRef: { value: number },
): void {
  checkSpace(8)
  doc.setDrawColor(200, 185, 170)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, yRef.value + 3, MARGIN + BODY_W, yRef.value + 3)
  yRef.value += 8
}

function renderBody(
  doc: jsPDF, text: string, indent: number, checkSpace: (n: number) => void,
  yRef: { value: number },
): void {
  checkSpace(LINE_H)
  const segments = parseInline(text)
  const { height } = writeInlineText(doc, segments, MARGIN + indent, yRef.value, BODY_W - indent)
  yRef.value += height + 1
}

// ── Main export -----------------------------------------------------------

export function markdownToPdfBlob(markdown: string): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  const addPage = () => { doc.addPage(); y = MARGIN }
  const checkSpace = (needed: number) => { if (y + needed > PAGE_H - MARGIN) addPage() }
  const yRef = { get value() { return y }, set value(v: number) { y = v } }

  const blocks = parseBlocks(markdown)

  const renderBlock: Record<string, (b: any) => void> = {
    h1: (b) => renderHeading(doc, b.text, checkSpace, yRef, { size: 18, color: [40, 35, 30], lineH: 8, gap: 6 }),
    h2: (b) => renderHeading(doc, b.text, checkSpace, yRef, { size: 14, color: [50, 45, 40], lineH: 7, gap: 4 }),
    h3: (b) => renderHeading(doc, b.text, checkSpace, yRef, { size: 12, color: [70, 65, 60], lineH: 6, gap: 3 }),
    blockquote: (b) => renderBlockquote(doc, b.text, checkSpace, yRef),
    bullet: (b) => renderListBlock(doc, b.text, b.indent ?? 10, checkSpace, yRef, '•', -5),
    numbered: (b) => renderListBlock(doc, b.text, b.indent ?? 10, checkSpace, yRef, `${b.number}.`, -8),
    code: (b) => renderCodeBlock(doc, b.text, b.lang, checkSpace, yRef),
    table: (b) => { const h = drawTable(doc, b.rows, MARGIN, y, BODY_W); y += h + 4; },
    hr: (_b: any) => renderHr(doc, checkSpace, yRef),
    body: (b) => renderBody(doc, b.text, b.indent ?? 0, checkSpace, yRef),
  }
  for (const block of blocks) renderBlock[block.type]?.(block)

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont(FONT, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(150, 140, 130)
    doc.text(`— ${i} —`, PAGE_W / 2, PAGE_H - 10, { align: 'center' })
  }

  return doc.output('blob')
}
