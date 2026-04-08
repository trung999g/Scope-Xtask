/** Chuẩn hóa ID từ sheet / AI để ghép kết quả chấm điểm khớp nhau. */

export function normalizeXtaskId(raw: string | undefined | null): string {
  let s = String(raw ?? '').trim()
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '')
  return s
}

/** Id gửi trong payload AI — ưu tiên sub-task, không có thì main. */
export function auditPayloadId(task: {
  subTaskId: string
  mainTaskId: string
}): string {
  const sub = normalizeXtaskId(task.subTaskId)
  const main = normalizeXtaskId(task.mainTaskId)
  return sub || main
}

/** Khóa ổn định cho một dòng task (tránh trùng subTaskId giữa các main khác nhau). */
export function stableTaskRowKey(task: {
  subTaskId: string
  mainTaskId: string
}): string {
  const m = normalizeXtaskId(task.mainTaskId)
  const s = normalizeXtaskId(task.subTaskId)
  return `${m}|||${s}`
}
