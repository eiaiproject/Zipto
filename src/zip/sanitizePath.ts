export type SanitizedPath = {
  safePath: string
  isUnsafe: boolean
  reason?: string
}

export function sanitizeZipPath(path: string): SanitizedPath {
  const normalized = path.replaceAll('\u0000', '').replaceAll('\\', '/')
  const segments = normalized.split('/')
  const cleanSegments = segments.filter((segment) => segment && segment !== '.')

  if (!normalized.trim()) {
    return {
      safePath: '',
      isUnsafe: true,
      reason: 'Empty path',
    }
  }

  if (
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized)
  ) {
    return {
      safePath: cleanSegments.join('/'),
      isUnsafe: true,
      reason: 'Absolute path detected',
    }
  }

  if (segments.includes('..')) {
    return {
      safePath: cleanSegments.filter((segment) => segment !== '..').join('/'),
      isUnsafe: true,
      reason: 'Unsafe path traversal detected',
    }
  }

  return {
    safePath: cleanSegments.join('/'),
    isUnsafe: false,
  }
}

export function getFilename(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts.at(-1) ?? path
}

export function getExtension(path: string): string {
  const name = getFilename(path)
  const dotIndex = name.lastIndexOf('.')
  // Leading-dot files like .gitignore have no extension; treat as extensionless text
  if (dotIndex <= 0) return ''
  return name.slice(dotIndex + 1).toLowerCase()
}
