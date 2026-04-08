/**
 * Hàng đợi tuần tự + nghỉ tối thiểu giữa mọi request OpenAI,
 * tránh burst 429.
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseMs(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback
  const n = parseInt(raw, 10)
  if (Number.isNaN(n) || n < 0) return fallback
  return n
}

/** Ưu tiên VITE_AI_GLOBAL_GAP_MS, không có thì VITE_AI_CHUNK_GAP_MS, mặc định 9s (giảm 429 free tier) */
export function globalAiGapMs(): number {
  const g = import.meta.env.VITE_AI_GLOBAL_GAP_MS
  if (g !== undefined && g !== '') {
    return parseMs(g, 9000)
  }
  return parseMs(import.meta.env.VITE_AI_CHUNK_GAP_MS, 9000)
}

let chain: Promise<void> = Promise.resolve()

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
): Promise<T> {
  const run = chain.then(() => sleep(gapMs)).then(() => task())
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
