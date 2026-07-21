export type ConversionStatus =
  | 'idle'
  | 'reading'
  | 'ready'
  | 'converting'
  | 'completed'
  | 'cancelled'
  | 'failed'

export type ZipEntry = {
  path: string
  safePath: string
  name: string
  extension: string
  isDirectory: boolean
  compressedSize?: number
  uncompressedSize?: number
  isUnsafe: boolean
  unsafeReason?: string
}

export type ConversionResult = {
  sourcePath: string
  outputPath?: string
  status: 'converted' | 'skipped' | 'failed'
  reason?: string
}

export type UnsafePathResult = {
  path: string
  action: 'Skipped'
  reason: string
}

export type ConversionProgress = {
  status: ConversionStatus
  totalFiles: number
  processedFiles: number
  convertedFiles: number
  skippedFiles: number
  failedFiles: number
  currentFile?: string
  elapsedMs: number
}

export type ConversionReport = {
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
}

export type ZipReadResult = {
  entries: ZipEntry[]
  unsafePaths: UnsafePathResult[]
}

export type WorkerRequest =
  | {
      type: 'START_CONVERSION'
      file: File
    }
  | {
      type: 'CANCEL'
    }

export type WorkerResponse =
  | {
      type: 'ZIP_READ_PROGRESS'
      totalEntries?: number
      currentEntry?: string
    }
  | {
      type: 'PROGRESS'
      progress: ConversionProgress
    }
  | {
      type: 'COMPLETED'
      outputBlob: Blob
      report: ConversionReport
    }
  | {
      type: 'CANCELLED'
      partialOutputBlob?: Blob
      report?: ConversionReport
    }
  | {
      type: 'ERROR'
      message: string
      details?: string
    }
