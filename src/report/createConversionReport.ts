import type { ConversionReport, ConversionResult, UnsafePathResult } from '../types/conversion'

export function createConversionReportMarkdown(report: ConversionReport): string {
  const failedFiles = report.results.filter((r) => r.status === 'failed')
  const skippedFiles = report.results.filter((r) => r.status === 'skipped')

  const statusIcon = report.cancelled ? '⚠️' : report.completed ? '✅' : '❌'
  const statusText = report.cancelled ? 'Cancelled' : report.completed ? 'Completed' : 'Failed'

  const parts: string[] = [
    '# Conversion Report',
    '',
    `**Source ZIP:** \`${report.sourceZipName}\``,
    `**Converted at:** ${report.convertedAt}`,
    `**Status:** ${statusIcon} ${statusText}`,
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

  parts.push(`## Failed Files (${failedFiles.length})`)
  parts.push('')
  if (failedFiles.length === 0) {
    parts.push('None.')
  } else {
    parts.push(...failedFiles.map((f) => {
      return `- \`${escapeBackticks(f.sourcePath)}\` — ${f.reason ?? 'Unknown error'}`
    }))
  }
  parts.push('')

  parts.push(`## Skipped Files (${skippedFiles.length})`)
  parts.push('')
  if (skippedFiles.length === 0) {
    parts.push('None.')
  } else {
    parts.push(...skippedFiles.map((f) => {
      return `- \`${escapeBackticks(f.sourcePath)}\` — ${f.reason ?? 'Unknown reason'}`
    }))
  }
  parts.push('')

  parts.push(`## Unsafe Paths (${report.unsafePaths.length})`)
  parts.push('')
  if (report.unsafePaths.length === 0) {
    parts.push('None.')
  } else {
    parts.push(...report.unsafePaths.map((p) => {
      return `- \`${escapeBackticks(p.path)}\` — ${p.reason} (${p.action})`
    }))
  }
  parts.push('')

  if (report.warnings.length > 0) {
    parts.push('## Warnings')
    parts.push('')
    parts.push(...report.warnings.map((w) => `- ${w}`))
    parts.push('')
  }

  parts.push('---')
  parts.push('')
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
  return value.replace(/`/g, '\\`')
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}
