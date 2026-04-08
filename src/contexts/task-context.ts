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
  setSheetUrl: (url: string) => void
  sheetUrl: string
  apiKey: string
  setApiKey: (key: string) => void
  aiModel: string
  setAiModel: (m: string) => void
  aiPrompts: AiPromptConfig
  setAiPrompts: (p: AiPromptConfig) => void
}

export const TaskContext = createContext<TaskContextType | undefined>(undefined)
