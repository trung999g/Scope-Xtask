/** Chỉ dùng endpoint nhập tay trong UI; không đọc base URL từ env. */
export function normalizeOpenAiEndpoint(raw: string | undefined): string {
  return (raw ?? '').trim().replace(/\/+$/, '')
}

export function getOpenAiChatCompletionsUrl(endpoint: string): string {
  const base = normalizeOpenAiEndpoint(endpoint)
  if (!base) return ''
  return `${base}/chat/completions`
}

export function hasOpenAiEndpoint(endpoint: string | undefined): boolean {
  return normalizeOpenAiEndpoint(endpoint).length > 0
}
