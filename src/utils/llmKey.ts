import { DEFAULT_AI_MODEL } from '@/constants/aiPromptDefaults'
import {
    hasOpenAiEndpoint,
    normalizeOpenAiEndpoint,
} from '@/utils/openAiEndpoint'

/**
 * Chỉ dùng OpenAI Chat Completions — không gọi Google Gemini.
 *
 * Key: key nhập tay (tab Prompt / localStorage) nếu không rỗng → VITE_OPENAI_API_KEY → VITE_AI_API_KEY.
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
 * Model id gửi lên API. Với gateway OpenAI-compatible (base URL tùy chỉnh), giữ nguyên id
 * (vd. MWG). Trên api.openai.com chỉ chấp nhận gpt-*, o1, o3, o4…
 */
export function coerceOpenAiModelId(model: string, endpoint?: string): string {
  const m = model.trim()
  const lower = m.toLowerCase()
  const hasEndpoint = hasOpenAiEndpoint(endpoint)

  // localStorage/UI cũ có thể còn gemini-* — trên gateway nội bộ dùng VITE_AI_MODEL (vd. MWG).
  if (lower.startsWith('gemini-')) {
    if (hasEndpoint) {
      const envM = envTrim(import.meta.env.VITE_AI_MODEL)
      return envM || DEFAULT_AI_MODEL
    }
    return DEFAULT_AI_MODEL
  }

  if (hasEndpoint) {
    if (m) return m
    const envM = envTrim(import.meta.env.VITE_AI_MODEL)
    return envM || DEFAULT_AI_MODEL
  }

  if (m) return m
  return envTrim(import.meta.env.VITE_AI_MODEL) || DEFAULT_AI_MODEL
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
  const u = (userKey ?? '').trim()
  if (u) return u
  const o = envTrim(import.meta.env.VITE_OPENAI_API_KEY)
  if (o) return o
  return envTrim(import.meta.env.VITE_AI_API_KEY)
}

/** Đủ điều kiện gọi LLM: bắt buộc có endpoint; key có thể rỗng với gateway nội bộ. */
export function isLlmConfigured(
  userKey: string | undefined,
  endpoint: string | undefined,
): boolean {
  if (!hasOpenAiEndpoint(endpoint)) return false
  if (resolveLlmApiKey(userKey)) return true
  return true
}

export function sanitizeLlmEndpoint(endpoint: string | undefined): string {
  return normalizeOpenAiEndpoint(endpoint)
}

export function hasBuiltInLlmKey(): boolean {
  return describeBuiltInLlmKeySource() !== null
}
