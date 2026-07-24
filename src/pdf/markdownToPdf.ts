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

function parseInline(text: string): Array<{ text: string; styles: TextStyle }> {
  const segments: Array<{ text: string; styles: TextStyle }> = []
  let remaining = text

  while (remaining.length > 0) {
    // Inline code: `code`
    const codeMatch = remaining.match(/^([^`]*)`([^`]+)`(.*)$/)
    if (codeMatch) {
      if (codeMatch[1]) segments.push({ text: codeMatch[1], styles: {} })
      segments.push({ text: codeMatch[2], styles: { code: true } })
      remaining = codeMatch[3]
      continue
    }

    // Bold+italic: ***text*** or ___text___
    const boldItalicStar = remaining.match(/^([^*]*)\*\*\*([^*]+)\*\*\*(.*)$/)
    const boldItalicUnd = remaining.match(/^([^_]*)___([^_]+)___(.*)$/)
    if (boldItalicStar) {
      if (boldItalicStar[1]) segments.push({ text: boldItalicStar[1], styles: {} })
      segments.push({ text: boldItalicStar[2], styles: { bold: true, italic: true } })
      remaining = boldItalicStar[3]
      continue
    }
    if (boldItalicUnd) {
      if (boldItalicUnd[1]) segments.push({ text: boldItalicUnd[1], styles: {} })
      segments.push({ text: boldItalicUnd[2], styles: { bold: true, italic: true } })
      remaining = boldItalicUnd[3]
      continue
    }

    // Bold: **text** or __text__
    const boldStar = remaining.match(/^([^*]*)\*\*([^*]+)\*\*(.*)$/)
    const boldUnd = remaining.match(/^([^_]*)__([^_]+)__(.*)$/)
    if (boldStar) {
      if (boldStar[1]) segments.push({ text: boldStar[1], styles: {} })
      segments.push({ text: boldStar[2], styles: { bold: true } })
      remaining = boldStar[3]
      continue
    }
    if (boldUnd) {
      if (boldUnd[1]) segments.push({ text: boldUnd[1], styles: {} })
      segments.push({ text: boldUnd[2], styles: { bold: true } })
      remaining = boldUnd[3]
      continue
    }

    // Italic: *text* or _text_
    const italicStar = remaining.match(/^([^*]*)\*([^*]+)\*(.*)$/)
    const italicUnd = remaining.match(/^([^_]*)_([^_]+)_(.*)$/)
    if (italicStar) {
      if (italicStar[1]) segments.push({ text: italicStar[1], styles: {} })
      segments.push({ text: italicStar[2], styles: { italic: true } })
      remaining = italicStar[3]
      continue
    }
    if (italicUnd) {
      if (italicUnd[1]) segments.push({ text: italicUnd[1], styles: {} })
      segments.push({ text: italicUnd[2], styles: { italic: true } })
      remaining = italicUnd[3]
      continue
    }

    // No more formatting
    segments.push({ text: remaining, styles: {} })
    break
  }

  return segments
}

function parseBlocks(md: string): Block[] {
  const blocks: Block[] = []
  const lines = md.split('\n')
  let i = 0

  const flushTable = (tableLines: string[]) => {
    if (tableLines.length < 2) return
    // Filter out separator line (e.g. |---|---|) and empty rows
    const dataLines = tableLines.filter(l => !/^[\s|:-]+$/.test(l))
    const rows = dataLines.map(l => l.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1))
    if (rows.length > 0 && rows[0].length > 0) {
      blocks.push({ type: 'table', rows })
    }
  }

  while (i < lines.length) {
    const raw = lines[i]
    const trimmed = raw.trim()

    // Code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim() || ''
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({ type: 'code', text: codeLines.join('\n'), lang })
      i++
      continue
    }

    // Table detection
    if (/^\|.+\|$/.test(trimmed)) {
      const tableLines: string[] = []
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
        tableLines.push(lines[i].trim())
        i++
      }
      flushTable(tableLines)
      continue
    }

    // Headings
    if (trimmed.startsWith('# ')) { blocks.push({ type: 'h1', text: trimmed.slice(2) }); i++; continue }
    if (trimmed.startsWith('## ')) { blocks.push({ type: 'h2', text: trimmed.slice(3) }); i++; continue }
    if (trimmed.startsWith('### ')) { blocks.push({ type: 'h3', text: trimmed.slice(4) }); i++; continue }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2))
        i++
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join(' ') })
      continue
    }

    // Horizontal rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // Lists
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/)
    if (bulletMatch) {
      blocks.push({ type: 'bullet', text: bulletMatch[1], indent: 10 })
      i++
      continue
    }

    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
    if (numberedMatch) {
      blocks.push({ type: 'numbered', text: numberedMatch[2], number: parseInt(numberedMatch[1], 10), indent: 10 })
      i++
      continue
    }

    // Empty line - skip
    if (!trimmed) {
      i++
      continue
    }

    // Regular paragraph
    blocks.push({ type: 'body', text: raw })
    i++
  }

  return blocks
}

/** Set the doc font/style/size for a given TextStyle. */
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
  segments: Array<{ text: string; styles: TextStyle }>,
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
    const parts = seg.text.match(/\S+|\s+/g) || [seg.text]
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
    const isWhitespace = /^\s+$/.test(token.text)

    if (currentX > x && currentX + tw > x + maxWidth) {
      // Word doesn't fit → wrap to next line
      currentY += LINE_H
      currentX = x
      lineCount++
      // Discard whitespace at start of a line
      if (isWhitespace) continue
    }

    doc.text(token.text, currentX, currentY)
    currentX += tw
  }

  // Reset font to default for subsequent blocks
  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)

  return { lines: lineCount, height: lineCount * LINE_H }
}

/** Estimate how many lines a plain text would wrap into. */
function estimateLines(doc: jsPDF, text: string, maxWidth: number): number {
  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  return (doc.splitTextToSize(text, maxWidth) as string[]).length
}

// ── Table drawing ────────────────────────────────────────────────────────

function drawTable(doc: jsPDF, rows: string[][], x: number, y: number, maxWidth: number): number {
  if (rows.length === 0) return 0

  const colCount = rows[0].length
  if (colCount === 0) return 0

  const colWidth = maxWidth / colCount
  const padX = 1.5
  const padY = 1.5
  let currentY = y

  // Compute optimal row heights based on actual content
  const rowHeights: number[] = []
  for (let r = 0; r < rows.length; r++) {
    let maxCellLines = 1
    for (let c = 0; c < colCount; c++) {
      doc.setFont(FONT, r === 0 ? 'bold' : 'normal')
      doc.setFontSize(r === 0 ? 8 : 7.5)
      const cellLines = (doc.splitTextToSize(rows[r][c] || '', colWidth - padX * 2) as string[]).length
      maxCellLines = Math.max(maxCellLines, cellLines)
    }
    // Header row is slightly taller
    const baseH = r === 0 ? 7 : 5.5
    rowHeights.push(baseH + (maxCellLines - 1) * 4)
  }

  // Check if whole table fits; if not, start on a new page
  const totalH = rowHeights.reduce((a, b) => a + b, 0)
  if (currentY + totalH > PAGE_H - MARGIN) {
    doc.addPage()
    currentY = MARGIN
  }

  // ── Draw header row ──
  doc.setFillColor(60, 50, 40)
  doc.rect(x, currentY, maxWidth, rowHeights[0], 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(8)

  for (let c = 0; c < colCount; c++) {
    const cellText = doc.splitTextToSize(rows[0][c] || '', colWidth - padX * 2) as string[]
    doc.text(cellText, x + c * colWidth + padX, currentY + padY + 2.5)
  }

  currentY += rowHeights[0]

  // ── Draw data rows ──
  doc.setFont(FONT, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(60, 50, 40)

  for (let r = 1; r < rows.length; r++) {
    const rowH = rowHeights[r]

    if (currentY + rowH > PAGE_H - MARGIN) {
      doc.addPage()
      currentY = MARGIN
    }

    // Alternating row background
    if (r % 2 === 0) {
      doc.setFillColor(248, 245, 240)
      doc.rect(x, currentY, maxWidth, rowH, 'F')
    }

    // Border
    doc.setDrawColor(200, 190, 180)
    doc.rect(x, currentY, maxWidth, rowH)

    for (let c = 0; c < colCount; c++) {
      const cellText = doc.splitTextToSize(rows[r][c] || '', colWidth - padX * 2) as string[]
      doc.text(cellText, x + c * colWidth + padX, currentY + padY + 2)
    }

    currentY += rowH
  }

  doc.setTextColor(0, 0, 0)
  return currentY - y + 2
}

// ── Main export ──────────────────────────────────────────────────────────

export function markdownToPdfBlob(markdown: string): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  const addPage = () => {
    doc.addPage()
    y = MARGIN
  }

  const checkSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) addPage()
  }

  const blocks = parseBlocks(markdown)

  for (const block of blocks) {
    switch (block.type) {
      case 'h1': {
        checkSpace(14)
        doc.setFont(FONT, 'bold')
        doc.setFontSize(18)
        doc.setTextColor(40, 35, 30)
        const lines = doc.splitTextToSize(block.text, BODY_W) as string[]
        doc.text(lines, MARGIN, y)
        y += lines.length * 8 + 6
        doc.setTextColor(0, 0, 0)
        break
      }
      case 'h2': {
        checkSpace(12)
        doc.setFont(FONT, 'bold')
        doc.setFontSize(14)
        doc.setTextColor(50, 45, 40)
        const lines = doc.splitTextToSize(block.text, BODY_W) as string[]
        doc.text(lines, MARGIN, y)
        y += lines.length * 7 + 4
        doc.setTextColor(0, 0, 0)
        break
      }
      case 'h3': {
        checkSpace(10)
        doc.setFont(FONT, 'bold')
        doc.setFontSize(12)
        doc.setTextColor(70, 65, 60)
        const lines = doc.splitTextToSize(block.text, BODY_W) as string[]
        doc.text(lines, MARGIN, y)
        y += lines.length * 6 + 3
        doc.setTextColor(0, 0, 0)
        break
      }

      case 'blockquote': {
        const segments = parseInline(block.text)
        const fullText = segments.map(s => s.text).join('')
        const estimatedLines = estimateLines(doc, fullText, BODY_W - 12)
        const contentH = Math.max(estimatedLines * LINE_H, LINE_H)
        const blockH = contentH + 10

        checkSpace(blockH)

        // Left vertical accent bar
        doc.setDrawColor(180, 160, 140)
        doc.setLineWidth(0.8)
        doc.line(MARGIN, y, MARGIN, y + contentH)

        // Background fill
        doc.setFillColor(250, 248, 245)
        doc.rect(MARGIN + 2, y + 1, BODY_W - 4, contentH, 'F')

        // Text content and capture actual rendered height
        const { height: actualHeight } = writeInlineText(doc, segments, MARGIN + 6, y + 4, BODY_W - 12)

        y += Math.max(blockH, actualHeight)
        break
      }

      case 'bullet': {
        checkSpace(LINE_H)
        const bulletX = MARGIN + (block.indent ?? 10)
        // Draw bullet marker
        doc.setFont(FONT, 'normal')
        doc.setFontSize(9)
        doc.text('•', bulletX - 5, y)
        // Render text and capture actual height
        const segments = parseInline(block.text)
        const { height } = writeInlineText(doc, segments, bulletX, y, BODY_W - (block.indent ?? 10))
        y += height + 1
        break
      }

      case 'numbered': {
        checkSpace(LINE_H)
        const numX = MARGIN + (block.indent ?? 10)
        doc.setFont(FONT, 'normal')
        doc.setFontSize(9)
        doc.text(`${block.number}.`, numX - 8, y)
        const segments = parseInline(block.text)
        const { height } = writeInlineText(doc, segments, numX, y, BODY_W - (block.indent ?? 10))
        y += height + 1
        break
      }

      case 'code': {
        // Estimate height first
        doc.setFont('courier', 'normal')
        doc.setFontSize(7.5)
        const codeLines = block.text.split('\n').flatMap(l => doc.splitTextToSize(l, BODY_W - 10) as string[])
        const codeH = codeLines.length * 4 + 8

        checkSpace(codeH)

        // Background
        doc.setFillColor(242, 238, 233)
        doc.rect(MARGIN, y - 3, BODY_W, codeH, 'F')
        // Border
        doc.setDrawColor(200, 185, 170)
        doc.rect(MARGIN, y - 3, BODY_W, codeH)

        // Language label
        if (block.lang) {
          doc.setFont(FONT, 'italic')
          doc.setFontSize(7)
          doc.setTextColor(120, 110, 100)
          doc.text(block.lang, MARGIN + 4, y - 1)
          doc.setTextColor(0, 0, 0)
        }

        // Code text
        doc.setFont('courier', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(50, 45, 40)
        doc.text(codeLines, MARGIN + 5, y + 4)
        doc.setTextColor(0, 0, 0)

        y += codeH + 4
        break
      }

      case 'table': {
        const tableH = drawTable(doc, block.rows, MARGIN, y, BODY_W)
        y += tableH + 4
        break
      }

      case 'hr': {
        checkSpace(8)
        doc.setDrawColor(200, 185, 170)
        doc.setLineWidth(0.5)
        doc.line(MARGIN, y + 3, MARGIN + BODY_W, y + 3)
        y += 8
        break
      }

      case 'body': {
        checkSpace(LINE_H)
        const indent = block.indent ?? 0
        const segments = parseInline(block.text)
        const { height } = writeInlineText(doc, segments, MARGIN + indent, y, BODY_W - indent)
        y += height + 1
        break
      }
    }
  }

  // ── Footer: page numbers ──
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
