import { DEFAULT_AI_MODEL } from '@/constants/aiPromptDefaults'
import {
    enqueueAiRequest,
    scoringQueueGapMs,
    sleepOrAbort,
} from '@/services/aiRequestGate'
import type { SheetAiAuditRow } from '@/services/GoogleSheetService'
import { GoogleSheetService } from '@/services/GoogleSheetService'
import type { Task, TaskType } from '@/types'
import type { AiPromptConfig } from '@/types/aiPrompts'
import { coerceOpenAiModelId } from '@/utils/llmKey'
import {
    getOpenAiChatCompletionsUrl,
    hasOpenAiEndpoint,
} from '@/utils/openAiEndpoint'
import {
    auditPayloadId,
    normalizeXtaskId,
} from '@/utils/taskIds'

function openAiCompatHeaders(apiKey: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const t = apiKey.trim()
  if (t) headers.Authorization = `Bearer ${t}`
  return headers
}

const TASK_TYPES: TaskType[] = [
  'feature',
  'improvement',
  'bug',
  'fixbug',
  'maintenance',
  'leave',
]

/**
 * Tối đa số phiếu / một lần gọi API (cùng với giới hạn ký tự — xem buildPayloadBatches).
 * Mặc định 14: ít round-trip hơn 6, vẫn nhỏ hơn gom cả NV một phát.
 */
function scoreMaxTasksPerBatch(): number {
  const raw = import.meta.env.VITE_AI_SCORE_CHUNK_SIZE
  const n = raw !== undefined && raw !== '' ? parseInt(raw, 10) : 10
  if (Number.isNaN(n) || n < 1) return 10
  return Math.min(50, n)
}

/** Giới hạn độ dài gần đúng của mảng JSON payload (ký tự) — tránh một request quá nặng. */
function scoreMaxPayloadChars(): number {
  const raw = import.meta.env.VITE_AI_SCORE_MAX_PAYLOAD_CHARS
  const n = raw !== undefined && raw !== '' ? parseInt(raw, 10) : 22_000
  if (Number.isNaN(n) || n < 4000) return 22_000
  return Math.min(80_000, n)
}

function buildPayloadBatches(rows: SheetAiAuditRow[]): SheetAiAuditRow[][] {
  const maxTasks = scoreMaxTasksPerBatch()
  const maxChars = scoreMaxPayloadChars()
  const batches: SheetAiAuditRow[][] = []
  let batch: SheetAiAuditRow[] = []
  let batchChars = 0

  for (const row of rows) {
    const rowLen = JSON.stringify(row).length
    const nextChars =
      batch.length === 0 ? rowLen : batchChars + 1 + rowLen

    if (
      batch.length >= maxTasks ||
      (batch.length > 0 && nextChars > maxChars)
    ) {
      batches.push(batch)
      batch = [row]
      batchChars = rowLen
    } else {
      batch.push(row)
      batchChars = nextChars
    }
  }
  if (batch.length > 0) batches.push(batch)
  return batches
}

type OpenAiHttpError = Error & { status?: number; retryAfterMs?: number }

function isAbortLike(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  )
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
  if (err && typeof err === 'object' && 'retryAfterMs' in err) {
    const ms = (err as { retryAfterMs?: unknown }).retryAfterMs
    if (typeof ms === 'number' && ms > 0) {
      return Math.min(300_000, Math.ceil(ms) + Math.random() * 4000)
    }
  }
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
    const base = 22_000 * 2 ** attempt
    return Math.min(300_000, base + jitter)
  }
  return Math.min(240_000, 9000 * (attempt + 1) + jitter)
}

const OPENAI_USER_JSON_HINT = `

Trả về đúng một object JSON (không markdown) với khóa "results" là mảng; mỗi phần tử khớp "id" VÀ "msnv" từ đúng một dòng PAYLOAD (dữ liệu Google Sheet).`

async function openAiChatWithRetry(
  apiKey: string,
  endpoint: string,
  model: string,
  systemInstruction: string,
  userMessage: string,
  signal?: AbortSignal,
): Promise<string> {
  const maxAttempts = 12
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      const chatUrl = getOpenAiChatCompletionsUrl(endpoint)
      if (!chatUrl) {
        throw new Error('Thiếu API endpoint. Vào tab Prompt AI để nhập URL endpoint.')
      }
      return await enqueueAiRequest(async () => {
        const res = await fetch(chatUrl, {
          method: 'POST',
          headers: openAiCompatHeaders(apiKey),
          signal,
          body: JSON.stringify({
            model: model.trim() || 'gpt-4o',
            messages: [
              { role: 'system', content: systemInstruction },
              {
                role: 'user',
                content: userMessage + OPENAI_USER_JSON_HINT,
              },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
            max_tokens: 8192,
          }),
        })
        const raw = await res.text()
        if (!res.ok) {
          const err: OpenAiHttpError = new Error(
            `OpenAI [${res.status}]: ${raw.length > 1200 ? `${raw.slice(0, 1200)}…` : raw}`,
          )
          err.status = res.status
          const ra = res.headers.get('retry-after')
          if (ra) {
            const sec = parseFloat(ra)
            if (!Number.isNaN(sec) && sec > 0) {
              err.retryAfterMs = sec * 1000
            }
          }
          try {
            const j = JSON.parse(raw) as { error?: { message?: string } }
            const tryIn = j.error?.message?.match(
              /try again in ([\d.]+)\s*s/i,
            )
            if (tryIn) {
              err.retryAfterMs =
                Math.ceil(parseFloat(tryIn[1]) * 1000) + 2000
            }
          } catch {
            /* ignore */
          }
          throw err
        }
        let data: unknown
        try {
          data = JSON.parse(raw)
        } catch {
          throw new Error(`OpenAI: body không phải JSON: ${raw.slice(0, 200)}`)
        }
        const content = (
          data as { choices?: { message?: { content?: string } }[] }
        ).choices?.[0]?.message?.content
        if (!content || typeof content !== 'string') {
          throw new Error('OpenAI: thiếu choices[0].message.content')
        }
        return content
      }, scoringQueueGapMs(), signal)
    } catch (e) {
      if (isAbortLike(e) || signal?.aborted) {
        throw e instanceof Error ? e : new DOMException('Aborted', 'AbortError')
      }
      lastErr = e
      if (!isRetriableApiError(e) || attempt === maxAttempts - 1) {
        if (isRetriableApiError(e)) {
          const base = e instanceof Error ? e.message : String(e)
          let hint: string
          if (isLikelyOverload503(e)) {
            hint =
              'Máy chủ OpenAI tạm thời quá tải hoặc bảo trì. Đợi vài phút rồi thử lại.'
          } else if (isLikelyQuota429(e)) {
            hint =
              'Hết hạn mức / rate limit OpenAI (429). Kiểm tra billing, tăng VITE_AI_GLOBAL_GAP_MS, hoặc thử model khác.'
          } else {
            hint =
              'Lỗi mạng hoặc API tạm thời — thử lại sau hoặc kiểm tra key OpenAI.'
          }
          throw new Error(`${base}\n\n${hint}`)
        }
        throw e
      }
      await sleepOrAbort(retryDelayMs(e, attempt), signal)
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('openAiChatWithRetry: không thành công')
}

type AiScoreEntry = {
  id: string
  msnv?: string
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

function buildUserPayloadMessage(payload: SheetAiAuditRow[]): string {
  return `Trả về ĐÚNG một mảng JSON hoặc object { "results": [...] } (OpenAI JSON mode).

Mỗi object trong PAYLOAD là một dòng export Google Sheet: **id** (phiếu), **msnv** (mã nhân viên cột phụ trách). Với mỗi dòng PAYLOAD phải có ĐÚNG một kết quả có cùng **id** và cùng **msnv** (không đổi MSNV, không bớt dòng).

Dựa trên toàn bộ chữ trong PAYLOAD — gồm **title, desc, URL, mã ticket, tên trang tài liệu** xuất hiện trên phiếu. Được suy luận có kiểm soát từ **mô tả liên kết** (đường dẫn, project, epic) và **ngữ cảnh stack / vibe FE** để chấm đúng vai trò; **không** bịa chi tiết kỹ thuật không có manh mối trong các trường text này.

Thiếu mô tả chi tiết, desc rỗng hoặc descIsOnlyTitle (trùng title): **vẫn phải** trả đủ id/msnv với difficulty, finalScore (tối thiểu 1 khi title thể hiện việc FE hợp lệ), status **VAGUE** hoặc OK — không dùng USELESS chỉ vì không có đoạn mô tả dài.

**Mô tả mơ hồ** (chữ chung chung, không nêu màn/flow/hạng mục rõ): dùng **VAGUE**, chấm thận trọng theo rubric (thường điểm 1–2, difficulty 1–2; tối đa 3 nếu title+link/doc trong phiếu đủ gợi scope; không 4đ / không difficulty 4). **aiComment** phải nhắc mức mơ hồ.

PAYLOAD (lô hiện tại):
${JSON.stringify(payload)}`
}

/** Dự phòng khi chưa có snapshot CSV (không khuyến nghị). */
function auditRowsFromTasksFallback(tasks: Task[]): SheetAiAuditRow[] {
  return tasks.map((t) => {
    const titleTrim = (t.title ?? '').trim()
    const descTrim = (t.description ?? '').trim()
    const msnv = (t.assigneeId ?? '').trim()
    return {
      id: auditPayloadId(t),
      msnv,
      assigneeName: t.assigneeName || undefined,
      mainTaskId: t.mainTaskId,
      subTaskId: t.subTaskId,
      xtaskRole: t.xtaskRole,
      title: t.title,
      desc: t.description,
      descIsOnlyTitle: descTrim === titleTrim && titleTrim.length > 0,
      lateDays: t.lateDays,
      workingHours: t.workingHours ?? 0,
      assigneeCell: [t.assigneeId, t.assigneeName].filter(Boolean).join(' — '),
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

  const taskType = normalizeTaskType(entry.taskType)
  const status = (entry.status ?? 'OK').toUpperCase()

  const titleTrim = (task.title ?? '').trim()
  const descTrim = (task.description ?? '').trim()
  const thinDescription =
    !descTrim || descTrim === titleTrim || titleTrim.length === 0

  let rawScore = clampScore(entry.finalScore)
  let difficulty = clampDifficulty(entry.difficulty)
  /** AI đôi khi trả USELESS/0 khi chỉ thiếu mô tả — hệ thống vẫn ghi nhận điểm tối thiểu từ title. */
  let uselessBumpedToOne = false
  /** VAGUE: trần điểm/difficulty; hoặc nâng sàn 0→1 khi title đủ ý (mô tả mỏng). */
  let vagueCapped = false
  let vagueFlooredToOne = false
  if (status === 'FRAUD') {
    rawScore = 0
  } else if (status === 'USELESS') {
    rawScore = 0
    if (thinDescription && titleTrim.length >= 5) {
      rawScore = 1
      uselessBumpedToOne = true
    }
  } else if (status === 'VAGUE') {
    if (rawScore > 3) {
      rawScore = 3
      vagueCapped = true
    }
    if (thinDescription) {
      if (rawScore > 2) {
        rawScore = 2
        vagueCapped = true
      }
      if (difficulty > 2) {
        difficulty = 2
        vagueCapped = true
      }
    } else if (difficulty > 3) {
      difficulty = 3
      vagueCapped = true
    }
    if (thinDescription && titleTrim.length >= 5 && rawScore < 1) {
      rawScore = 1
      vagueFlooredToOne = true
    }
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
    if (uselessBumpedToOne) {
      notes = `${notes ? `${notes} | ` : ''}AI: nội dung mỏng — giữ 1đ theo title (thiếu mô tả chi tiết)`.trim()
    } else {
      notes = `${notes ? `${notes} | ` : ''}AI: USELESS (0đ)`.trim()
    }
  } else if (status === 'VAGUE') {
    const parts = ['mô tả mơ hồ']
    if (vagueFlooredToOne) parts.push('tối thiểu 1đ theo title')
    if (vagueCapped) parts.push('trần điểm/difficulty theo rubric')
    notes = `${notes ? `${notes} | ` : ''}AI: ${parts.join(' — ')}`.trim()
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
   * Chấm điểm & phân loại qua OpenAI Chat Completions (ChatGPT API).
   * Payload từ CSV qua GoogleSheetService khi có `sheetCsvText` (khuyến nghị).
   */
  async scoreTasksWithAI(
    tasks: Task[],
    apiKey: string,
    endpoint: string,
    model: string,
    prompts: AiPromptConfig,
    options?: {
      sheetCsvText?: string
      blockedHashtags?: string[]
      /** Hủy giữa các lô hoặc trong lúc gọi API — kết quả các lô đã xong vẫn được giữ. */
      signal?: AbortSignal
      /**
       * Gọi sau mỗi lô chấm thành công — `scoredTasks` là toàn bộ `tasks` đầu vào
       * với các phiếu đã có kết quả AI được merge; phiếu chưa tới lô giữ nguyên.
       */
      onBatchComplete?: (info: {
        batchIndex: number
        batchCount: number
        scoredTasks: Task[]
      }) => void
    },
  ): Promise<Task[]> {
    if (tasks.length === 0) return tasks
    const token = (apiKey ?? '').trim()
    if (!hasOpenAiEndpoint(endpoint)) return tasks

    const resolvedModel = coerceOpenAiModelId(
      model.trim() || DEFAULT_AI_MODEL,
      endpoint,
    )
    const systemInstruction = buildSystemInstruction(prompts)

    const byId = new Map<string, AiScoreEntry>()
    let abortedEarly = false

    const toScore = tasks.filter((t) => !t.isDuplicate)
    let payloads: SheetAiAuditRow[]
    if (options?.sheetCsvText) {
      payloads = await GoogleSheetService.buildAiAuditPayloadForTasks(
        options.sheetCsvText,
        options.blockedHashtags ?? [],
        toScore,
      )
      if (payloads.length === 0 && toScore.length > 0) {
        throw new Error(
          'Không ghép được phiếu với CSV đã tải. Tải lại sheet ở tab Nhập liệu (cùng hashtag chặn).',
        )
      }
    } else {
      payloads = auditRowsFromTasksFallback(toScore)
    }

    const runOneChunk = async (
      userMessage: string,
    ): Promise<{ response: { text: () => string } }> => {
      const text = await openAiChatWithRetry(
        token,
        endpoint,
        resolvedModel,
        systemInstruction,
        userMessage,
        options?.signal,
      )
      return { response: { text: () => text } }
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

    /** Chỉ merge các task đã có entry — không gắn “không trả kết quả” cho task chưa chấm. */
    const mergeScoredSoFar = (): Task[] =>
      tasks.map((t) => {
        if (t.isDuplicate) return t
        const entry = lookupEntry(t)
        if (!entry) return t
        return mergeAiOntoTask(t, entry)
      })

    const batches = buildPayloadBatches(payloads)
    try {
      if (batches.length > 0) {
        for (let idx = 0; idx < batches.length; idx++) {
          if (options?.signal?.aborted) {
            abortedEarly = true
            break
          }
          const slice = batches[idx]
          const userMessage = buildUserPayloadMessage(slice)
          const result = await runOneChunk(userMessage)
          const responseText = result.response.text()
          let parsed: unknown[]
          try {
            parsed = parseResponseToArray(responseText)
          } catch {
            throw new Error(
              `AI trả JSON không hợp lệ (lô ${idx + 1}/${batches.length}). Thử giảm VITE_AI_SCORE_CHUNK_SIZE / VITE_AI_SCORE_MAX_PAYLOAD_CHARS hoặc đổi model.`,
            )
          }
          for (const row of parsed) {
            const e = row as AiScoreEntry
            if (e?.id == null || e.id === '') continue
            const idNorm = normalizeXtaskId(String(e.id))
            if (!idNorm) continue
            byId.set(idNorm, { ...e, id: idNorm })
          }
          options?.onBatchComplete?.({
            batchIndex: idx,
            batchCount: batches.length,
            scoredTasks: mergeScoredSoFar(),
          })
        }
      }
    } catch (err) {
      if (isAbortLike(err) || options?.signal?.aborted) {
        abortedEarly = true
      } else {
        throw err
      }
    }

    return tasks.map((t) => {
      if (t.isDuplicate) return t
      const entry = lookupEntry(t)
      if (!entry && abortedEarly) return t
      return mergeAiOntoTask(t, entry)
    })
  },
}

export type PingOpenAiResult =
  | { ok: true }
  | { ok: false; status?: number; message: string }

/**
 * Một request Chat Completions rất nhỏ — không qua hàng đợi chấm điểm (dùng để kiểm tra key/model).
 */
export async function pingOpenAiConnection(
  apiKey: string,
  endpoint: string,
  model: string,
  signal?: AbortSignal,
): Promise<PingOpenAiResult> {
  const key = apiKey.trim()
  const chatUrl = getOpenAiChatCompletionsUrl(endpoint)
  if (!chatUrl) {
    return { ok: false, message: 'Thiếu API endpoint. Vui lòng nhập URL endpoint.' }
  }
  const m = coerceOpenAiModelId(model.trim() || DEFAULT_AI_MODEL, endpoint)
  try {
    const res = await fetch(chatUrl, {
      method: 'POST',
      headers: openAiCompatHeaders(key),
      signal,
      body: JSON.stringify({
        model: m,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 4,
        temperature: 0,
      }),
    })
    const raw = await res.text()
    if (!res.ok) {
      let hint = raw
      try {
        const j = JSON.parse(raw) as { error?: { message?: string } }
        if (j.error?.message) hint = j.error.message
      } catch {
        /* ignore */
      }
      const slice = hint.slice(0, 380)
      if (res.status === 429) {
        return {
          ok: false,
          status: 429,
          message: `429 — rate limit / quota OpenAI. Gợi ý: đổi gpt-4o-mini, bật VITE_AI_COMPACT_SYSTEM_PROMPT, kiểm tra billing. Chi tiết: ${slice}`,
        }
      }
      return {
        ok: false,
        status: res.status,
        message: `[${res.status}] ${slice}`,
      }
    }
    return { ok: true }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: false, message: 'Đã hủy.' }
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    }
  }
}
