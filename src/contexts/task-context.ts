import type { Employee, Task } from '@/types'
import type { AiPromptConfig } from '@/types/aiPrompts'
import { createContext, type Dispatch, type SetStateAction } from 'react'

export interface TaskContextType {
  tasks: Task[]
  setTasks: Dispatch<SetStateAction<Task[]>>
  employees: Employee[]
  selectedEmployeeId: string | null
  setSelectedEmployeeId: (id: string | null) => void
  currentEmployee: Employee | null
  fetchTasks: (
    url: string,
    employees: Employee[],
    blockedHashtags: string[],
  ) => Promise<void>
  /** Đọc nội dung CSV đã export (file cục bộ) — cùng format cột với Sheet; chấm AI vẫn dùng snapshot này. */
  importTasksFromCsvText: (
    csvText: string,
    employees: Employee[],
    blockedHashtags: string[],
    sourceLabel?: string,
  ) => Promise<void>
  setSheetUrl: (url: string) => void
  sheetUrl: string
  apiKey: string
  setApiKey: (key: string) => void
  aiEndpoint: string
  setAiEndpoint: (url: string) => void
  aiModel: string
  setAiModel: (m: string) => void
  aiPrompts: AiPromptConfig
  setAiPrompts: (p: AiPromptConfig) => void
  /** Snapshot CSV lần tải gần nhất (tab Nhập liệu) — dùng build payload AI từ Sheet. */
  getLastSheetImport: () => {
    csvText: string
    blockedHashtags: string[]
  } | null
}

export const TaskContext = createContext<TaskContextType | undefined>(undefined)
