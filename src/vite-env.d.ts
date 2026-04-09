/// <reference types="vite/client" />
/* eslint-disable @typescript-eslint/no-unused-vars -- bổ sung kiểu env cho import.meta */

interface ImportMetaEnv {
  /** Build: vite.config define + VERCEL_GIT_COMMIT_SHA trên Vercel */
  readonly VITE_APP_GIT_SHA: string
  readonly VITE_OPENAI_API_KEY?: string
  /** Key OpenAI chung khi không đặt VITE_OPENAI_API_KEY. */
  readonly VITE_AI_API_KEY?: string
  readonly VITE_AI_MODEL?: string
  /**
   * `true`/`1`: dùng system prompt rút gọn (ít token) — hữu ích khi 429 do TPM (tokens/phút) với tier thấp.
   */
  readonly VITE_AI_COMPACT_SYSTEM_PROMPT?: string
  /** Khoảng nghỉ giữa mỗi batch chấm AI (ms), giảm 429 RPM */
  readonly VITE_AI_CHUNK_GAP_MS?: string
  /** Nghỉ tối thiểu giữa mọi request OpenAI (ms). Ưu tiên hơn VITE_AI_CHUNK_GAP_MS nếu set. */
  readonly VITE_AI_GLOBAL_GAP_MS?: string
  /**
   * Chấm AI ngay sau khi tải sheet. `false`/`0` = tắt (khuyến nghị tránh 429), chỉ chấm khi bấm nút ở Kết quả.
   */
  readonly VITE_AI_AUTO_SCORE?: string
  /**
   * Tối đa số phiếu / mỗi lần gọi chấm (mặc định 14, cùng giới hạn VITE_AI_SCORE_MAX_PAYLOAD_CHARS).
   * Giảm nếu 429/timeout; tăng cẩn thận.
   */
  readonly VITE_AI_SCORE_CHUNK_SIZE?: string
  /**
   * Tối đa độ dài JSON payload (ký tự) mỗi lô chấm (mặc định ~22000).
   */
  readonly VITE_AI_SCORE_MAX_PAYLOAD_CHARS?: string
  /**
   * Nghỉ giữa các lô chấm (ms). Không set = dùng VITE_AI_GLOBAL_GAP_MS / VITE_AI_CHUNK_GAP_MS.
   */
  readonly VITE_AI_SCORE_GAP_MS?: string
}

declare global {
  interface Window {
    setActiveTab?: (
      tab: 'input' | 'output' | 'rules' | 'guide' | 'prompts',
    ) => void
  }
}

export { }

