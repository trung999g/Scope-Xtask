/**
 * Hàng đợi tuần tự + nghỉ tối thiểu giữa mọi request OpenAI,
 * tránh burst 429.
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Chờ ms hoặc báo lỗi ngay khi signal.abort (để nút Hủy chấm có hiệu lực trong lúc nghỉ RPM). */
export function sleepOrAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return sleep(ms)
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'))
  }
  const s = signal
  return new Promise((resolve, reject) => {
    const t = setTimeout(finish, ms)
    function onAbort() {
      clearTimeout(t)
      s.removeEventListener('abort', onAbort)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    function finish() {
      s.removeEventListener('abort', onAbort)
      resolve()
    }
    s.addEventListener('abort', onAbort)
  })
}

function parseMs(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback
  const n = parseInt(raw, 10)
  if (Number.isNaN(n) || n < 0) return fallback
  return n
}

/**
 * Nghỉ giữa các request OpenAI. Mặc định 14s (giảm 429 RPM).
 * Tăng qua VITE_AI_GLOBAL_GAP_MS / VITE_AI_CHUNK_GAP_MS nếu vẫn 429.
 */
export function globalAiGapMs(): number {
  const g = import.meta.env.VITE_AI_GLOBAL_GAP_MS
  if (g !== undefined && g !== '') {
    return parseMs(g, 14_000)
  }
  return parseMs(import.meta.env.VITE_AI_CHUNK_GAP_MS, 14_000)
}

let chain: Promise<void> = Promise.resolve()

/** Thời điểm request OpenAI trước đó hoàn tất (0 = chưa có — bỏ qua nghỉ trước lần gọi đầu). */
let lastOpenAiRequestEndMs = 0

/**
 * Khoảng nghỉ giữa các lần chấm điểm (nhiều lô).
 * Mặc định = globalAiGapMs(); có thể giảm bằng VITE_AI_SCORE_GAP_MS (cẩn thận 429).
 */
export function scoringQueueGapMs(): number {
  const raw = import.meta.env.VITE_AI_SCORE_GAP_MS
  if (raw !== undefined && raw !== '') {
    return parseMs(raw, globalAiGapMs())
  }
  return globalAiGapMs()
}

export function enqueueAiRequest<T>(
  task: () => Promise<T>,
  gapMs: number = globalAiGapMs(),
  signal?: AbortSignal,
): Promise<T> {
  const run = chain.then(async () => {
    if (lastOpenAiRequestEndMs > 0) {
      const elapsed = Date.now() - lastOpenAiRequestEndMs
      const needWait = Math.max(0, gapMs - elapsed)
      if (needWait > 0) await sleepOrAbort(needWait, signal)
    }
    try {
      return await task()
    } finally {
      lastOpenAiRequestEndMs = Date.now()
    }
  })
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
