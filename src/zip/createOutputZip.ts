import { strToU8, zipSync } from 'fflate'

export type OutputZipFiles = Record<string, Uint8Array>

export function createOutputZip(files: OutputZipFiles): Blob {
  const bytes = zipSync(files, { level: 6 })
  return new Blob([bytes], { type: 'application/zip' })
}

export function markdownToBytes(markdown: string): Uint8Array {
  return strToU8(markdown)
}
