import type { ConversionReport, ConversionResult, UnsafePathResult } from '../types/conversion'

export function createConversionReportMarkdown(report: ConversionReport): string {
  const failedFiles = report.results.filter((r) => r.status === 'failed')
  const skippedFiles = report.results.filter((r) => r.status === 'skipped')

  let statusText = 'Failed'
  if (report.cancelled) statusText = 'Cancelled'
  else if (report.completed) statusText = 'Completed'
  // ponytail: status icon omitted; replace with inline reicon.dev SVG when assets available

  const parts: string[] = [
    '# Conversion Report',
    '',
    `**Source ZIP:** \`${report.sourceZipName}\``,
    `**Converted at:** ${report.convertedAt}`,
    `**Status:** ${statusText}`,
    '',
    '## Summary',
    '',
    '| Metric | Count |',
    '|--------|------:|',
    `| Total files | ${report.totalFiles} |`,
    `| Processed | ${report.processedFiles} |`,
    `| Converted | ${report.convertedFiles} |`,
    `| Skipped | ${report.skippedFiles} |`,
    `| Failed | ${report.failedFiles} |`,
    '',
  ]

  parts.push(`## Failed Files (${failedFiles.length})`, '')
  if (failedFiles.length === 0) {
    parts.push('None.')
  } else {
    parts.push(...failedFiles.map((f) => {
      return `- \`${escapeBackticks(f.sourcePath)}\` — ${f.reason ?? 'Unknown error'}`
    }))
  }
  parts.push('')

  parts.push(`## Skipped Files (${skippedFiles.length})`, '')
  if (skippedFiles.length === 0) {
    parts.push('None.')
  } else {
    parts.push(...skippedFiles.map((f) => {
      return `- \`${escapeBackticks(f.sourcePath)}\` — ${f.reason ?? 'Unknown reason'}`
    }))
  }
  parts.push('')

  parts.push(`## Unsafe Paths (${report.unsafePaths.length})`, '')
  if (report.unsafePaths.length === 0) {
    parts.push('None.')
  } else {
    parts.push(...report.unsafePaths.map((p) => {
      return `- \`${escapeBackticks(p.path)}\` — ${p.reason} (${p.action})`
    }))
  }
  parts.push('')

  if (report.warnings.length > 0) {
    parts.push('## Warnings', '', ...report.warnings.map((w) => `- ${w}`), '')
  }

  parts.push('---', '')
  parts.push('*All files were processed locally in the browser. No data was uploaded to any server.*')

  return parts.join('\n')
}

export function createReport(params: {
  sourceZipName: string
  convertedAt: string
  completed: boolean
  cancelled: boolean
  totalFiles: number
  processedFiles: number
  convertedFiles: number
  skippedFiles: number
  failedFiles: number
  results: ConversionResult[]
  warnings: string[]
  unsafePaths: UnsafePathResult[]
}): ConversionReport {
  return params
}

export function formatConversionTimestamp(date = new Date()): string {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())

  return `${year}-${month}-${day} ${hours}:${minutes}`
}



function escapeBackticks(value: string): string {
  return value.replaceAll('`', '\\`')
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}
