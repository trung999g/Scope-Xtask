import { DEFAULT_AI_MODEL } from '@/constants/aiPromptDefaults'

/**
 * Chỉ dùng OpenAI Chat Completions — không gọi Google Gemini.
 *
 * Key: VITE_OPENAI_API_KEY → VITE_AI_API_KEY → key nhập tay (tab Prompt / localStorage).
 */

function envTrim(key: string | undefined): string {
  return (key ?? '').trim()
}

/** Model id hợp lệ cho OpenAI API (gpt-*, o1, o3, o4…). */
export function isOpenAiModel(model: string): boolean {
  const m = model.trim().toLowerCase()
  return (
    m.startsWith('gpt-') ||
    m.startsWith('o1') ||
    m.startsWith('o3') ||
    m.startsWith('o4')
  )
}

/**
 * Model lưu trong UI/env có thể còn từ bản cũ (gemini-*). Luôn trả về id OpenAI hợp lệ.
 */
export function coerceOpenAiModelId(model: string): string {
  const m = model.trim()
  if (m && isOpenAiModel(m)) return m
  return DEFAULT_AI_MODEL
}

export function describeBuiltInLlmKeySource(): string | null {
  if (envTrim(import.meta.env.VITE_OPENAI_API_KEY))
    return 'VITE_OPENAI_API_KEY'
  if (envTrim(import.meta.env.VITE_AI_API_KEY)) return 'VITE_AI_API_KEY'
  return null
}

export function resolveLlmApiKey(
  userKey: string | undefined,
  _model?: string,
): string {
  void _model
  const o = envTrim(import.meta.env.VITE_OPENAI_API_KEY)
  if (o) return o
  const shared = envTrim(import.meta.env.VITE_AI_API_KEY)
  if (shared) return shared
  return (userKey ?? '').trim()
}

export function hasBuiltInLlmKey(): boolean {
  return describeBuiltInLlmKeySource() !== null
}
