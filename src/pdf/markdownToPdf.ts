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

interface InlineMatcher {
  regex: RegExp
  build: (match: RegExpExecArray) => { prefix: string; content: string; styles: TextStyle } | null
}

const CODE_RE = /^([^`]*)`([^`]+)`(.*)$/
const BOLD_ITALIC_STAR_RE = /^([^*]*)\*\*\*(\S+)\*\*\*(.*)$/
const BOLD_ITALIC_UND_RE = /^([^_]*)___(\S+)___(.*)$/
const BOLD_STAR_RE = /^([^*]*)\*\*(\S+)\*\*(.*)$/
const BOLD_UND_RE = /^([^_]*)__(\S+)__(.*)$/
const ITALIC_STAR_RE = /^([^*]*)\*(\S+)\*(.*)$/
const ITALIC_UND_RE = /^([^_]*)_(\S+)_(.*)$/

const INLINE_MATCHERS: InlineMatcher[] = [
  {
    regex: CODE_RE,
    build: (m) => m[1] !== undefined
      ? { prefix: m[1], content: m[2], styles: { code: true } }
      : null,
  },
  {
    regex: BOLD_ITALIC_STAR_RE,
    build: (m) => ({ prefix: m[1], content: m[2], styles: { bold: true, italic: true } }),
  },
  {
    regex: BOLD_ITALIC_UND_RE,
    build: (m) => ({ prefix: m[1], content: m[2], styles: { bold: true, italic: true } }),
  },
  {
    regex: BOLD_STAR_RE,
    build: (m) => ({ prefix: m[1], content: m[2], styles: { bold: true } }),
  },
  {
    regex: BOLD_UND_RE,
    build: (m) => ({ prefix: m[1], content: m[2], styles: { bold: true } }),
  },
  {
    regex: ITALIC_STAR_RE,
    build: (m) => ({ prefix: m[1], content: m[2], styles: { italic: true } }),
  },
  {
    regex: ITALIC_UND_RE,
    build: (m) => ({ prefix: m[1], content: m[2], styles: { italic: true } }),
  },
]

function tryMatchInline(remaining: string): { prefix: string; content: string; styles: TextStyle; rest: string } | null {
  for (const matcher of INLINE_MATCHERS) {
    const m = matcher.regex.exec(remaining)
    if (m) {
      const result = matcher.build(m)
      if (result) {
        return { ...result, rest: m[3] }
      }
    }
  }
  return null
}

function parseInline(text: string): InlineSeg[] {
  const segments: InlineSeg[] = []
  let remaining = text

  while (remaining.length > 0) {
    const matched = tryMatchInline(remaining)
    if (matched) {
      if (matched.prefix) {
        segments.push({ text: matched.prefix, styles: {} })
      }
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

const TABLE_LINE_RE = /^\|.+\|$/
const BULLET_RE = /^[-*]\s+(.*)$/
const NUMBERED_RE = /^(\d+)\.\s+(.*)$/

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
    // Split into words: non-whitespace runs and whitespace runs
    const parts: string[] = []
    let segRemaining = seg.text
    while (segRemaining.length > 0) {
      const nonWs = /^\S+/.exec(segRemaining)
      if (nonWs) { parts.push(nonWs[0]); segRemaining = segRemaining.slice(nonWs[0].length); continue }
      const ws = /^\s+/.exec(segRemaining)
      if (ws) { parts.push(ws[0]); segRemaining = segRemaining.slice(ws[0].length); continue }
      // Should not reach here for typical text
      break
    }
    for (const part of parts) {
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
  colCount: number,
  colWidth: number,
  padX: number,
  rowH: number,
  x: number,
  currentY: number,
  tableWidth: number,
): number {
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
    currentY = drawTableRow(doc, rows, r, colCount, colWidth, padX, rowHeights[r], x, currentY, tableMaxWidth)
  }

  doc.setTextColor(0, 0, 0)
  return currentY - y + 2
}

// ── Block renderers (extracted to reduce markdownToPdfBlob complexity) ----

function renderHeading(
  doc: jsPDF, text: string, checkSpace: (n: number) => void,
  yRef: { value: number },
  size: number, r: number, g: number, b: number, lineH: number, gap: number,
): void {
  checkSpace(size + 4)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(size)
  doc.setTextColor(r, g, b)
  const lines = doc.splitTextToSize(text, BODY_W) as string[]
  doc.text(lines, MARGIN, yRef.value)
  yRef.value += lines.length * lineH + gap
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

  for (const block of blocks) {
    switch (block.type) {
      case 'h1': renderHeading(doc, block.text, checkSpace, yRef, 18, 40, 35, 30, 8, 6); break
      case 'h2': renderHeading(doc, block.text, checkSpace, yRef, 14, 50, 45, 40, 7, 4); break
      case 'h3': renderHeading(doc, block.text, checkSpace, yRef, 12, 70, 65, 60, 6, 3); break
      case 'blockquote': renderBlockquote(doc, block.text, checkSpace, yRef); break
      case 'bullet': renderListBlock(doc, block.text, block.indent ?? 10, checkSpace, yRef, '•', -5); break
      case 'numbered': renderListBlock(doc, block.text, block.indent ?? 10, checkSpace, yRef, `${block.number}.`, -8); break
      case 'code': renderCodeBlock(doc, block.text, block.lang, checkSpace, yRef); break
      case 'table': { const h = drawTable(doc, block.rows, MARGIN, y, BODY_W); y += h + 4; break }
      case 'hr': renderHr(doc, checkSpace, yRef); break
      case 'body': renderBody(doc, block.text, block.indent ?? 0, checkSpace, yRef); break
    }
  }

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
