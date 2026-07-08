export function codeBlockToMarkdown(content: string, language: string): string {
  const fence = createFence(content)
  return `${fence}${language}\n${content.replace(/\s+$/, '')}\n${fence}\n`
}

function createFence(content: string): string {
  const matches = content.match(/`{3,}/g) ?? []
  const longestFence = matches.reduce((longest, match) => {
    return Math.max(longest, match.length)
  }, 2)

  return '`'.repeat(Math.max(3, longestFence + 1))
}
