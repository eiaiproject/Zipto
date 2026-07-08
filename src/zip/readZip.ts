import { unzipSync, type UnzipFileInfo } from 'fflate'
import type { UnsafePathResult, ZipEntry, ZipReadResult } from '../types/conversion'
import { getExtension, getFilename, sanitizeZipPath } from './sanitizePath'

export async function readZipEntries(file: File): Promise<ZipReadResult> {
  const data = new Uint8Array(await file.arrayBuffer())
  return readZipEntriesFromData(data)
}

export function readZipEntriesFromData(data: Uint8Array): ZipReadResult {
  const entries: ZipEntry[] = []
  const unsafePaths: UnsafePathResult[] = []

  unzipSync(data, {
    filter(info) {
      const entry = createZipEntry(info)
      entries.push(entry)

      if (entry.isUnsafe && entry.unsafeReason) {
        unsafePaths.push({
          path: entry.path,
          action: 'Skipped',
          reason: entry.unsafeReason,
        })
      }

      return false
    },
  })

  return { entries, unsafePaths }
}

function createZipEntry(info: UnzipFileInfo): ZipEntry {
  const sanitized = sanitizeZipPath(info.name)
  const isDirectory = info.name.endsWith('/') || sanitized.safePath.endsWith('/')
  const safePath = sanitized.safePath.replace(/\/$/, '')
  const displayName = getFilename(safePath || info.name)

  return {
    path: info.name,
    safePath,
    name: displayName,
    extension: isDirectory ? '' : getExtension(displayName),
    isDirectory,
    compressedSize: info.size,
    uncompressedSize: info.originalSize,
    isUnsafe: sanitized.isUnsafe,
    unsafeReason: sanitized.reason,
  }
}
