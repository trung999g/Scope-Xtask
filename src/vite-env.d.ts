/// <reference types="vite/client" />
/* eslint-disable @typescript-eslint/no-unused-vars -- bổ sung kiểu env cho import.meta */

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_GEMINI_API_KEY?: string
  readonly VITE_AI_MODEL?: string
  /** Khoảng nghỉ giữa mỗi batch chấm AI (ms), giảm 429 RPM */
  readonly VITE_AI_CHUNK_GAP_MS?: string
  /** Model dự phòng khi 429/503 (mặc định code: gemini-2.5-flash) */
  readonly VITE_AI_FALLBACK_MODEL?: string
  /** Nghỉ tối thiểu giữa mọi request Gemini (ms). Ưu tiên hơn VITE_AI_CHUNK_GAP_MS nếu set. */
  readonly VITE_AI_GLOBAL_GAP_MS?: string
  /**
   * Chấm AI ngay sau khi tải sheet. `false`/`0` = tắt (khuyến nghị tránh 429), chỉ chấm khi bấm nút ở Kết quả.
   */
  readonly VITE_AI_AUTO_SCORE?: string
}

export { }

declare global {
  interface Window {
    setActiveTab?: (
      tab: 'input' | 'output' | 'rules' | 'guide' | 'prompts',
    ) => void
  }
}
