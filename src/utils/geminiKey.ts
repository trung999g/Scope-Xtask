/**
 * @deprecated Ưu tiên `resolveLlmApiKey(userKey, model)` — hỗ trợ cả OpenAI và Gemini.
 * Hàm này chỉ ánh xạ key môi trường Gemini (không nhìn model).
 */
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
