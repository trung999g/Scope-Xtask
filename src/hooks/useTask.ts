import { useContext } from 'react'
import { TaskContext } from '@/contexts/task-context'

export function useTask() {
  const ctx = useContext(TaskContext)
  if (ctx === undefined) {
    throw new Error('useTask phải dùng bên trong TaskProvider')
  }
  return ctx
}
