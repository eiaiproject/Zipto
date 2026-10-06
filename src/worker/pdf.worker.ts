import { markdownToPdfBlob } from '../pdf/markdownToPdf'

export type PdfWorkerRequest = {
  type: 'GENERATE_PDF'
  blob: Blob
}

export type PdfWorkerResponse =
  | {
      type: 'PDF_DONE'
      blob: Blob
    }
  | {
      type: 'PDF_ERROR'
      message: string
    }

self.onmessage = (event: MessageEvent<PdfWorkerRequest>) => {
  if (event.data.type !== 'GENERATE_PDF') return
  void (async () => {
    try {
      // Decode inside the worker so the main thread never holds the full text too
      const markdown = await event.data.blob.text()
      const blob = markdownToPdfBlob(markdown)
      self.postMessage({ type: 'PDF_DONE', blob } satisfies PdfWorkerResponse)
    } catch (error) {
      self.postMessage({
        type: 'PDF_ERROR',
        message: error instanceof Error ? error.message : 'Failed to generate PDF.',
      } satisfies PdfWorkerResponse)
    }
  })()
}
