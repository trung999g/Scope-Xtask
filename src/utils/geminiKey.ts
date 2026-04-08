/** Key dùng cho Gemini: ưu tiên biến build/deploy, sau đó key người dùng (tab Prompt AI / localStorage). */
export function resolveGeminiApiKey(userKey: string | undefined): string {
  const env = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim()
  if (env) return env
  return (userKey ?? '').trim()
}

export function hasBuiltInGeminiKey(): boolean {
  return Boolean(
    (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim(),
  )
}
