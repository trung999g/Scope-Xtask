import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROMPTS,
} from '@/constants/aiPromptDefaults'
import { TaskContext } from '@/contexts/task-context'
import { AIService } from '@/services/AIService'
import { GoogleSheetService } from '@/services/GoogleSheetService'
import type { Employee, Task } from '@/types'
import type { AiPromptConfig } from '@/types/aiPrompts'
import { resolveGeminiApiKey } from '@/utils/geminiKey'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

const LS_API = 'gemini_api_key'
const LS_MODEL = 'xtask_ai_model_v1'

/** Key do người dùng/nhập tay (không gồm VITE_GEMINI_API_KEY — key chung lấy qua resolveGeminiApiKey). */
function readStoredUserApiKey(): string {
  try {
    return localStorage.getItem(LS_API) ?? ''
  } catch {
    return ''
  }
}

function readInitialModel(): string {
  try {
    const stored = localStorage.getItem(LS_MODEL)
    return (
      stored || import.meta.env.VITE_AI_MODEL || DEFAULT_AI_MODEL
    )
  } catch {
    return DEFAULT_AI_MODEL
  }
}

/** Luôn rubric mặc định trong code; không merge/ghi localStorage (tránh tự đổi prompt cũ). */
function readInitialPrompts(): AiPromptConfig {
  return DEFAULT_AI_PROMPTS
}

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  )
  const [sheetUrl, setSheetUrl] = useState('')
  const [apiKey, setApiKey] = useState(readStoredUserApiKey)

  const [aiModel, setAiModelState] = useState(readInitialModel)
  const [aiPrompts, setAiPromptsState] = useState(readInitialPrompts)

  const aiConfigRef = useRef({ apiKey, aiModel, aiPrompts })
  useEffect(() => {
    aiConfigRef.current = { apiKey, aiModel, aiPrompts }
  }, [apiKey, aiModel, aiPrompts])

  const setAiModel = useCallback((m: string) => {
    setAiModelState(m)
    try {
      localStorage.setItem(LS_MODEL, m)
    } catch {
      /* ignore */
    }
  }, [])

  const setAiPrompts = useCallback((p: AiPromptConfig) => {
    setAiPromptsState(p)
  }, [])

  useEffect(() => {
    if (import.meta.env.VITE_GEMINI_API_KEY) return
    if (apiKey) {
      try {
        localStorage.setItem(LS_API, apiKey)
      } catch {
        /* ignore */
      }
    }
  }, [apiKey])

  const currentEmployee =
    employees.find((e) => e.id === selectedEmployeeId) ?? null

  const fetchTasks = useCallback(
    async (
      url: string,
      employeeList: Employee[],
      blockedHashtags: string[],
    ) => {
      try {
        setSheetUrl(url)
        setEmployees(employeeList)

        const csvUrl = url.includes('/edit')
          ? url.replace('/edit', '/export') + '&format=csv'
          : url
        const response = await fetch(csvUrl)
        const csvText = await response.text()

        const parsedTasks = await GoogleSheetService.parseTasksFromCsv(
          csvText,
          blockedHashtags,
        )

        const validEmployeeIds = employeeList.map((e) => e.id)
        const filteredTasks = parsedTasks.filter((t) =>
          validEmployeeIds.includes(t.assigneeId),
        )

        setTasks(filteredTasks)

        const autoScore =
          import.meta.env.VITE_AI_AUTO_SCORE === 'true' ||
          import.meta.env.VITE_AI_AUTO_SCORE === '1'

        const { apiKey: keyFromState, aiModel: model, aiPrompts: prompts } =
          aiConfigRef.current
        const key = resolveGeminiApiKey(keyFromState)
        if (!autoScore || !key || filteredTasks.length === 0) return

        try {
          const scored = await AIService.scoreTasksWithAI(
            filteredTasks,
            key,
            model,
            prompts,
          )
          setTasks(scored)
        } catch (err) {
          console.error('Chấm AI tự động thất bại:', err)
          window.alert(
            err instanceof Error
              ? err.message
              : 'Chấm AI tự động thất bại. Vào tab Kết quả và bấm Chấm AI.',
          )
        }
      } catch (error) {
        console.error('Error fetching tasks:', error)
        throw error
      }
    },
    [],
  )

  const value = useMemo(
    () => ({
      tasks,
      setTasks,
      employees,
      selectedEmployeeId,
      setSelectedEmployeeId,
      currentEmployee,
      fetchTasks,
      setSheetUrl,
      sheetUrl,
      apiKey,
      setApiKey,
      aiModel,
      setAiModel,
      aiPrompts,
      setAiPrompts,
    }),
    [
      tasks,
      employees,
      selectedEmployeeId,
      currentEmployee,
      fetchTasks,
      sheetUrl,
      apiKey,
      aiModel,
      setAiModel,
      aiPrompts,
      setAiPrompts,
    ],
  )

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>
}
