/**
 * Chọn API key theo model: GPT-* / o* → OpenAI; còn lại → Gemini (Google AI Studio).
 *
 * Thứ tự ưu tiên (mỗi nhánh): biến theo provider → VITE_AI_API_KEY (một key chung deploy) → key người dùng (tab Prompt / localStorage).
 */

function envTrim(key: string | undefined): string {
  return (key ?? '').trim()
}

export function isOpenAiModel(model: string): boolean {
  const m = model.trim().toLowerCase()
  return (
    m.startsWith('gpt-') ||
    m.startsWith('o1') ||
    m.startsWith('o3') ||
    m.startsWith('o4')
  )
}

/** Key LLM cấu hình qua env (không gồm key nhập tay). Dùng để hiển thị “đang lấy từ đâu”. */
export function describeBuiltInLlmKeySource(model: string): string | null {
  const shared = envTrim(import.meta.env.VITE_AI_API_KEY)
  if (isOpenAiModel(model)) {
    const o = envTrim(import.meta.env.VITE_OPENAI_API_KEY)
    if (o) return 'VITE_OPENAI_API_KEY'
    if (shared) return 'VITE_AI_API_KEY'
    return null
  }
  const g = envTrim(import.meta.env.VITE_GEMINI_API_KEY)
  if (g) return 'VITE_GEMINI_API_KEY'
  if (shared) return 'VITE_AI_API_KEY'
  return null
}

export function resolveLlmApiKey(
  userKey: string | undefined,
  model: string,
): string {
  const shared = envTrim(import.meta.env.VITE_AI_API_KEY)
  if (isOpenAiModel(model)) {
    const fromOpenAi = envTrim(import.meta.env.VITE_OPENAI_API_KEY)
    if (fromOpenAi) return fromOpenAi
    if (shared) return shared
    return (userKey ?? '').trim()
  }
  const fromGemini = envTrim(import.meta.env.VITE_GEMINI_API_KEY)
  if (fromGemini) return fromGemini
  if (shared) return shared
  return (userKey ?? '').trim()
}

export function hasBuiltInLlmKey(model: string): boolean {
  return describeBuiltInLlmKeySource(model) !== null
}
