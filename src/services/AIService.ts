import {
    DEFAULT_AI_FALLBACK_MODEL,
    DEFAULT_AI_MODEL,
} from '@/constants/aiPromptDefaults'
import { enqueueAiRequest } from '@/services/aiRequestGate'
import type { Task, TaskType } from '@/types'
import type { AiPromptConfig } from '@/types/aiPrompts'
import {
    auditPayloadId,
    normalizeXtaskId,
} from '@/utils/taskIds'

const TASK_TYPES: TaskType[] = [
  'feature',
  'improvement',
  'bug',
  'fixbug',
  'maintenance',
  'leave',
]

/** Số task / mỗi lần gọi Gemini — gom hết 1 request dễ >180s khi NV có nhiều phiếu. */
function scoreChunkSize(): number {
  const raw = import.meta.env.VITE_AI_SCORE_CHUNK_SIZE
  const n = raw !== undefined && raw !== '' ? parseInt(raw, 10) : 6
  if (Number.isNaN(n) || n < 1) return 6
  return Math.min(40, n)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getErrorStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const s = (err as { status?: unknown }).status
    if (typeof s === 'number' && s >= 400 && s < 600) return s
  }
  const msg = err instanceof Error ? err.message : String(err)
  const bracket = msg.match(/\[(\d{3})\s*[^\]]*\]/)
  if (bracket) {
    const code = parseInt(bracket[1], 10)
    if (!Number.isNaN(code)) return code
  }
  return undefined
}

/** Lỗi có thể chờ rồi gọi lại: 429, 503, 502, quá tải, v.v. */
function isRetriableApiError(err: unknown): boolean {
  const status = getErrorStatus(err)
  if (status === 429 || status === 503 || status === 502 || status === 500)
    return true
  const msg = err instanceof Error ? err.message : String(err)
  return /429|503|502|\[\s*500\s*\]|quota|Quota exceeded|rate.?limit|RESOURCE_EXHAUSTED|high demand|overloaded|unavailable|UNAVAILABLE|try again later|temporary/i.test(
    msg,
  )
}

function isLikelyOverload503(err: unknown): boolean {
  const status = getErrorStatus(err)
  if (status === 503 || status === 502) return true
  const msg = err instanceof Error ? err.message : String(err)
  return /503|502|high demand|overloaded|try again later/i.test(msg)
}

function isLikelyQuota429(err: unknown): boolean {
  const status = getErrorStatus(err)
  if (status === 429) return true
  const msg = err instanceof Error ? err.message : String(err)
  return /429|too many requests|quota|Quota exceeded|rate.?limit|RESOURCE_EXHAUSTED/i.test(
    msg,
  )
}

function retryDelayMs(err: unknown, attempt: number): number {
  const msg = err instanceof Error ? err.message : String(err)
  const m = msg.match(/retry in ([\d.]+)\s*s/i)
  if (m) {
    const sec = parseFloat(m[1])
    if (!Number.isNaN(sec)) {
      return Math.min(240_000, Math.ceil(sec * 1000) + 3000)
    }
  }
  const jitter = Math.random() * 4000
  if (isLikelyOverload503(err)) {
    const base = 10_000 * 2 ** attempt
    return Math.min(240_000, base + jitter)
  }
  if (isLikelyQuota429(err)) {
    const base = 14_000 * 2 ** attempt
    return Math.min(240_000, base + jitter)
  }
  return Math.min(240_000, 9000 * (attempt + 1) + jitter)
}

async function generateContentWithRetry(
  model: {
    generateContent: (p: string) => Promise<{ response: { text: () => string } }>
  },
  userMessage: string,
): Promise<{ response: { text: () => string } }> {
  const maxAttempts = 12
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await enqueueAiRequest(() => model.generateContent(userMessage))
    } catch (e) {
      lastErr = e
      if (!isRetriableApiError(e) || attempt === maxAttempts - 1) {
        if (isRetriableApiError(e)) {
          const base = e instanceof Error ? e.message : String(e)
          let hint: string
          if (isLikelyOverload503(e)) {
            hint =
              'Máy chủ Gemini đang quá tải hoặc tạm thời không phản hồi (503/502). Đợi vài phút rồi thử lại; hoặc đổi model ở tab Prompt AI (vd. gemini-2.0-flash-lite, gemini-2.5-flash). Xem: https://ai.google.dev/gemini-api/docs/troubleshooting'
          } else if (isLikelyQuota429(e)) {
            hint =
              'Hết quota / giới hạn gọi API (429). Bật VITE_AI_AUTO_SCORE=false, tăng VITE_AI_GLOBAL_GAP_MS, đổi model, hoặc bật billing. https://ai.google.dev/gemini-api/docs/rate-limits'
          } else {
            hint =
              'Lỗi mạng tạm thời — thử lại sau hoặc đổi model trong tab Prompt AI.'
          }
          throw new Error(`${base}\n\n${hint}`)
        }
        throw e
      }
      await sleep(retryDelayMs(e, attempt))
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('generateContentWithRetry: không thành công')
}

type AiScoreEntry = {
  id: string
  taskType?: string
  difficulty?: number
  finalScore?: number
  status?: string
  aiQualityScore?: number
  aiComment?: string
}

function extractJsonArray(text: string): string {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/u, '')
  }
  return t.trim()
}

function parseResponseToArray(responseText: string): unknown[] {
  const cleaned = extractJsonArray(responseText)
  const parsed: unknown = JSON.parse(cleaned)
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    const o = parsed as Record<string, unknown>
    for (const k of ['results', 'tasks', 'data', 'items']) {
      const v = o[k]
      if (Array.isArray(v)) return v
    }
  }
  throw new Error('AI phải trả mảng JSON hoặc object chứa results/tasks/data/items là mảng.')
}

function normalizeTaskType(raw: string | undefined): TaskType {
  const s = (raw ?? 'feature').toLowerCase().trim()
  if (TASK_TYPES.includes(s as TaskType)) return s as TaskType
  if (s === 'enhancement') return 'improvement'
  return 'feature'
}

function clampDifficulty(n: number | undefined): 1 | 2 | 3 | 4 {
  const x = Math.round(Number(n))
  if (Number.isNaN(x)) return 1
  return Math.min(4, Math.max(1, x)) as 1 | 2 | 3 | 4
}

function clampScore(n: number | undefined): number {
  const x = Math.round(Number(n))
  if (Number.isNaN(x)) return 0
  return Math.min(4, Math.max(0, x))
}

function applyLatePenalty(score: number, lateDays: number): number {
  const d = Math.max(0, Math.min(lateDays, 4))
  return Math.max(0, Math.min(4, score - d))
}

/** Rubric trong systemInstruction — tái sử dụng mọi lần gọi API (nhiều lô nhỏ). */
function buildSystemInstruction(prompts: AiPromptConfig): string {
  return `${prompts.roleAndMission}

## Phân loại độ khó (bắt buộc)
${prompts.difficultyRubric}

## Phân loại loại task
${prompts.taskTypeRubric}

## Chấm điểm
${prompts.scoringRubric}

## Toàn vẹn / gian lận
${prompts.integrityRules}

## Định dạng đầu ra
${prompts.jsonOutputContract}`
}

function buildUserPayloadMessage(
  payload: ReturnType<typeof toAuditPayload>,
): string {
  return `Trả về ĐÚNG một mảng JSON hợp lệ (application/json, không markdown).

Với MỖI phần tử trong PAYLOAD bên dưới phải có ĐÚNG một object tương ứng trong mảng; trường "id" khớp từng phần tử (không thêm/bớt id).

PAYLOAD (lô hiện tại):
${JSON.stringify(payload)}`
}

function toAuditPayload(tasks: Task[]) {
  return tasks.map((t) => {
    const title = (t.title ?? '').trim()
    const desc = (t.description ?? '').trim()
    return {
      id: auditPayloadId(t),
      mainTaskId: t.mainTaskId,
      xtaskRole: t.xtaskRole,
      title: t.title,
      desc: t.description,
      /** True khi CSV chỉ có một cột nội dung (title === description) */
      descIsOnlyTitle: desc === title && title.length > 0,
      lateDays: t.lateDays,
      workingHours: t.workingHours ?? 0,
    }
  })
}

function mergeAiOntoTask(task: Task, entry: AiScoreEntry | undefined): Task {
  if (!entry) {
    return {
      ...task,
      aiComment: task.aiComment ?? 'AI không trả kết quả cho task này.',
    }
  }

  const difficulty = clampDifficulty(entry.difficulty)
  const taskType = normalizeTaskType(entry.taskType)
  const status = (entry.status ?? 'OK').toUpperCase()

  let rawScore = clampScore(entry.finalScore)
  if (status === 'FRAUD' || status === 'USELESS') {
    rawScore = 0
  }

  const finalScore = applyLatePenalty(rawScore, task.lateDays)

  const aiQualityScore =
    entry.aiQualityScore !== undefined
      ? Math.min(4, Math.max(1, Math.round(Number(entry.aiQualityScore))))
      : undefined

  const isAiFraud = status === 'FRAUD'

  let notes = task.notes ?? ''
  if (status === 'FRAUD') {
    notes = `${notes ? `${notes} | ` : ''}AI: FRAUD (0đ)`.trim()
  } else if (status === 'USELESS') {
    notes = `${notes ? `${notes} | ` : ''}AI: USELESS (0đ)`.trim()
  } else if (status === 'VAGUE') {
    notes = `${notes ? `${notes} | ` : ''}AI: mô tả mơ hồ`.trim()
  }

  return {
    ...task,
    type: taskType,
    difficulty,
    baseScore: rawScore,
    finalScore,
    aiQualityScore,
    aiComment: entry.aiComment ?? '',
    isAiFraud,
    notes,
  }
}

export const AIService = {
  /**
   * Chấm toàn bộ điểm & phân loại bằng AI (Google AI Studio / Gemini API).
   */
  async scoreTasksWithAI(
    tasks: Task[],
    apiKey: string,
    model: string,
    prompts: AiPromptConfig,
  ): Promise<Task[]> {
    if (!apiKey || tasks.length === 0) return tasks

    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(apiKey)
    const genConfig = {
      generationConfig: {
        responseMimeType: 'application/json' as const,
        /** Đủ cho một lô (vài chục task) có aiComment. */
        maxOutputTokens: 12_288,
      },
    }
    const systemInstruction = buildSystemInstruction(prompts)

    const primaryId = model.trim() || DEFAULT_AI_MODEL
    const generativeModel = genAI.getGenerativeModel({
      model: primaryId,
      systemInstruction,
      ...genConfig,
    })
    const fallbackId = (
      (import.meta.env.VITE_AI_FALLBACK_MODEL as string | undefined)?.trim() ||
      DEFAULT_AI_FALLBACK_MODEL
    ).trim()

    const byId = new Map<string, AiScoreEntry>()

    const toScore = tasks.filter((t) => !t.isDuplicate)
    const payloads = toAuditPayload(toScore)

    const runOneChunk = async (
      userMessage: string,
    ): Promise<{ response: { text: () => string } }> => {
      try {
        return await generateContentWithRetry(generativeModel, userMessage)
      } catch (e) {
        if (
          fallbackId &&
          fallbackId !== primaryId &&
          (isLikelyOverload503(e) || isLikelyQuota429(e))
        ) {
          await sleep(2000 + Math.random() * 2000)
          const alt = genAI.getGenerativeModel({
            model: fallbackId,
            systemInstruction,
            ...genConfig,
          })
          return await generateContentWithRetry(alt, userMessage)
        }
        throw e
      }
    }

    const chunkSize = scoreChunkSize()
    if (payloads.length > 0) {
      for (let i = 0; i < payloads.length; i += chunkSize) {
        const slice = payloads.slice(i, i + chunkSize)
        const userMessage = buildUserPayloadMessage(slice)
        const result = await runOneChunk(userMessage)
        const responseText = result.response.text()
        let parsed: unknown[]
        try {
          parsed = parseResponseToArray(responseText)
        } catch {
          throw new Error(
            `AI trả JSON không hợp lệ (lô ${Math.floor(i / chunkSize) + 1}). Thử giảm VITE_AI_SCORE_CHUNK_SIZE hoặc đổi model.`,
          )
        }
        for (const row of parsed) {
          const e = row as AiScoreEntry
          if (e?.id == null || e.id === '') continue
          const idNorm = normalizeXtaskId(String(e.id))
          if (!idNorm) continue
          byId.set(idNorm, { ...e, id: idNorm })
        }
      }
    }

    const lookupEntry = (t: Task): AiScoreEntry | undefined => {
      const keys = [
        normalizeXtaskId(t.subTaskId),
        normalizeXtaskId(t.mainTaskId),
        String(t.subTaskId ?? '').trim(),
        String(t.mainTaskId ?? '').trim(),
      ].filter((k) => k.length > 0)
      const tried = new Set<string>()
      for (const k of keys) {
        if (tried.has(k)) continue
        tried.add(k)
        const x = byId.get(k) ?? byId.get(k.toLowerCase())
        if (x) return x
      }
      return undefined
    }

    return tasks.map((t) => {
      if (t.isDuplicate) return t
      return mergeAiOntoTask(t, lookupEntry(t))
    })
  },
}
