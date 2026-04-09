import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Cpu, ExternalLink, Loader2, Sparkles, StopCircle, Trophy, UserCircle2 } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTask } from '../../hooks/useTask';
import { AIService } from '../../services/AIService';
import { GoogleSheetService } from '../../services/GoogleSheetService';
import type { Task } from '../../types';
import { ScoringEngine } from '../../utils/ScoringEngine';
import { isLlmConfigured, resolveLlmApiKey } from '../../utils/llmKey';
import { stableTaskRowKey } from '../../utils/taskIds';

export const OutputPage: React.FC = () => {
  const { employees, selectedEmployeeId, setSelectedEmployeeId, tasks, setTasks, apiKey, aiEndpoint, aiModel, aiPrompts, getLastSheetImport } = useTask();
  const [isAiLoading, setIsAiLoading] = useState(false);
  /** Tiến trình từng lô chấm AI — cập nhật bảng ngay khi mỗi lô xong. */
  const [aiBatchProgress, setAiBatchProgress] = useState<string | null>(null);
  /** Khóa stableTaskRowKey — chỉ chấm AI các task được tick (giảm số lần gọi API, hạn 429). */
  const [selectedForAiKeys, setSelectedForAiKeys] = useState<Set<string>>(
    () => new Set(),
  );

  const currentEmployee = useMemo(() => 
    employees.find(e => e.id === selectedEmployeeId), 
  [employees, selectedEmployeeId]);

  const employeeTasks = useMemo(() => 
    tasks.filter(t => t.assigneeId === selectedEmployeeId),
  [tasks, selectedEmployeeId]);

  const scorableEmployeeTasks = useMemo(
    () => employeeTasks.filter((t) => !t.isDuplicate),
    [employeeTasks],
  );

  const lastAiEmployeeIdRef = useRef<string | null>(null)
  const aiAbortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!selectedEmployeeId) {
      setSelectedForAiKeys(new Set())
      lastAiEmployeeIdRef.current = null
      return
    }
    const eligibleKeys = new Set(
      scorableEmployeeTasks.map((t) => stableTaskRowKey(t)),
    )
    if (lastAiEmployeeIdRef.current !== selectedEmployeeId) {
      lastAiEmployeeIdRef.current = selectedEmployeeId
      setSelectedForAiKeys(eligibleKeys)
      return
    }
    setSelectedForAiKeys((prev) => {
      const next = new Set<string>()
      for (const k of prev) {
        if (eligibleKeys.has(k)) next.add(k)
      }
      return next
    })
  }, [selectedEmployeeId, scorableEmployeeTasks])

  const allScorableSelected =
    scorableEmployeeTasks.length > 0 &&
    scorableEmployeeTasks.every((t) =>
      selectedForAiKeys.has(stableTaskRowKey(t)),
    )

  const someScorableSelected = scorableEmployeeTasks.some((t) =>
    selectedForAiKeys.has(stableTaskRowKey(t)),
  )

  const toggleSelectAllAi = () => {
    const keys = scorableEmployeeTasks.map((t) => stableTaskRowKey(t))
    setSelectedForAiKeys((prev) => {
      const everyOn =
        keys.length > 0 && keys.every((k) => prev.has(k))
      if (everyOn) return new Set()
      return new Set(keys)
    })
  }

  const toggleOneAi = (rowKey: string) => {
    setSelectedForAiKeys((prev) => {
      const next = new Set(prev)
      if (next.has(rowKey)) next.delete(rowKey)
      else next.add(rowKey)
      return next
    })
  }

  const selectedForAiCount = scorableEmployeeTasks.filter((t) =>
    selectedForAiKeys.has(stableTaskRowKey(t)),
  ).length

  const totalMonthlyScore = useMemo(() => 
    ScoringEngine.calculateMonthlyTotal(employeeTasks), 
  [employeeTasks]);

  const stats = useMemo(() => {
    const totalFeaturePoints = employeeTasks
      .filter((t) => t.type === 'feature' || t.type === 'improvement')
      .reduce((acc, t) => acc + t.finalScore, 0)

    const totalBugPoints = employeeTasks
      .filter((t) => t.type === 'bug' || t.type === 'fixbug')
      .reduce((acc, t) => acc + t.finalScore, 0)

    const totalMaintenancePointsRaw = employeeTasks
      .filter((t) => t.type === 'maintenance')
      .reduce((acc, t) => acc + t.finalScore, 0)

    const featureBugTotal = totalFeaturePoints + totalBugPoints
    const cappedMaintenancePoints = Math.min(
      totalMaintenancePointsRaw,
      Math.round(featureBugTotal * 0.2),
    )

    const totalLeavePoints = employeeTasks
      .filter((t) => t.type === 'leave')
      .reduce((acc, t) => acc + t.finalScore, 0)

    const totalAiPoints = employeeTasks.reduce(
      (acc, t) => acc + (t.aiQualityScore ?? 0),
      0,
    )
    const maxAiPoints =
      employeeTasks.filter((t) => t.aiQualityScore !== undefined).length * 4

    return {
      totalFeaturePoints,
      totalBugPoints,
      totalMaintenancePoints: cappedMaintenancePoints,
      totalLeavePoints,
      totalAiPoints,
      maxAiPoints,
    }
  }, [employeeTasks])

  const handleAiReview = async () => {
    if (!isLlmConfigured(apiKey, aiEndpoint)) {
      alert(
        'Vui lòng mở tab "Prompt AI" và nhập API endpoint. API key là tùy chọn nếu gateway không cần Bearer.',
      );
      return;
    }
    const key = resolveLlmApiKey(apiKey)
    if (employeeTasks.length === 0) return;

    const toScore = employeeTasks.filter(
      (t) =>
        !t.isDuplicate && selectedForAiKeys.has(stableTaskRowKey(t)),
    )
    if (toScore.length === 0) {
      alert(
        'Chọn ít nhất một task (ô AI) để chấm. Task trùng/đã chặn không thể chấm AI.',
      )
      return
    }

    const sheetSnap = getLastSheetImport()
    if (!sheetSnap?.csvText) {
      alert(
        'Chưa có file CSV sheet trong phiên này. Vào tab "Nhập liệu" và tải lại link Google Sheet rồi chấm lại.',
      );
      return;
    }

    aiAbortControllerRef.current?.abort()
    const ac = new AbortController()
    aiAbortControllerRef.current = ac

    setIsAiLoading(true);
    setAiBatchProgress('Đang chấm…');
    try {
      /** Nhiều lô + retry + gap — không cắt timeout cứng (tránh lỗi giả khi NV có >50 phiếu). */
      const scoredSubset = await AIService.scoreTasksWithAI(
        toScore,
        key,
        aiEndpoint,
        aiModel,
        aiPrompts,
        {
          sheetCsvText: sheetSnap.csvText,
          blockedHashtags: sheetSnap.blockedHashtags,
          signal: ac.signal,
          onBatchComplete: ({ batchIndex, batchCount, scoredTasks }) => {
            setAiBatchProgress(
              `Lô ${batchIndex + 1}/${batchCount} xong — đã cập nhật kết quả trên bảng`,
            )
            const byRow = new Map<string, Task>(
              scoredTasks.map((t) => [stableTaskRowKey(t), t]),
            )
            setTasks((prev: Task[]) =>
              prev.map((t) => byRow.get(stableTaskRowKey(t)) ?? t),
            )
          },
        },
      )
      // Ghép lần cuối (phiếu thiếu entry AI được gắn nhắc; hủy sớm giữ partial đã merge).
      const byRow = new Map<string, Task>(
        scoredSubset.map((t) => [stableTaskRowKey(t), t]),
      )
      setTasks((prev: Task[]) =>
        prev.map((t) => byRow.get(stableTaskRowKey(t)) ?? t),
      )
    } catch (error) {
      const aborted =
        error instanceof DOMException && error.name === 'AbortError'
      if (!aborted) {
        console.error('AI Review Error:', error)
        alert(
          error instanceof Error
            ? error.message
            : 'Chấm AI thất bại. Xem console để biết chi tiết.',
        )
      }
    } finally {
      aiAbortControllerRef.current = null
      setAiBatchProgress(null);
      setIsAiLoading(false);
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-white/50">
        <p className="text-xl font-bold italic tracking-tighter">Hãy nhập dữ liệu ở tab "Nhập Liệu" để bắt đầu</p>
      </div>
    );
  }

  return (
    <div className="flex gap-6 min-h-[calc(100vh-180px)] animate-in fade-in duration-500 pb-10">
      {/* Sidebar: Employee List */}
      <div className="w-72 shrink-0 space-y-4">
        <div className="space-y-1 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
          {employees.map(emp => (
            <button
              key={emp.id}
              onClick={() => setSelectedEmployeeId(emp.id)}
              className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between group ${
                selectedEmployeeId === emp.id 
                  ? 'bg-slate-900 text-white shadow-lg' 
                  : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-100'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-bold text-sm truncate max-w-[150px]">{emp.name}</span>
                <span className={`text-[10px] uppercase font-bold opacity-60 ${selectedEmployeeId === emp.id ? 'text-white' : 'text-slate-400'}`}>ID: {emp.id}</span>
              </div>
              {selectedEmployeeId === emp.id && <Trophy size={14} className="text-amber-400" />}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Employee Details */}
      <div className="flex-1 space-y-6">
        <AnimatePresence mode="wait">
          {selectedEmployeeId ? (
            <motion.div 
              key={selectedEmployeeId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Header Stats */}
              <div className="grid grid-cols-5 gap-3">
                <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-xl">
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1 leading-none">TỔNG ĐIỂM</p>
                  <div className="text-3xl font-black text-white">{totalMonthlyScore}</div>
                </div>
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl text-white shadow-lg border border-indigo-400/30">
                  <p className="text-[10px] font-bold uppercase text-white/80 mb-1 leading-none flex items-center gap-1">
                    <Sparkles size={10} /> Điểm AI Gợi Ý
                  </p>
                  <div className="text-xl font-black text-white leading-none mt-1">
                    {stats.maxAiPoints > 0 ? `${stats.totalAiPoints}/${stats.maxAiPoints}` : '—'}
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1 leading-none">Task & Bug</p>
                  <div className="text-xl font-bold text-slate-800 leading-none mt-1">{ScoringEngine.roundScore(stats.totalFeaturePoints + stats.totalBugPoints)}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1 leading-none">Duy trì</p>
                  <div className="text-xl font-bold text-slate-800 leading-none mt-1">{ScoringEngine.roundScore(stats.totalMaintenancePoints)}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1 leading-none">Nghỉ phép</p>
                  <div className="text-xl font-bold text-slate-800 leading-none mt-1">{ScoringEngine.roundScore(stats.totalLeavePoints)}</div>
                </div>
              </div>

              <p className="text-[10px] text-slate-600 leading-relaxed rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2.5">
                <span className="font-black text-indigo-900">Lưu ý:</span> Cột{' '}
                <strong>Nhận xét AI</strong> chứa lời nhận xét/chất lượng mô tả từ model; cột{' '}
                <strong>Điểm</strong> và tổng hợp{' '}
                <strong>theo số điểm AI chấm</strong> (loại, độ khó, trừ muộn). Cột{' '}
                <strong>Ghi chú</strong> là cờ hệ thống / sheet (trùng, FRAUD, …).                 Chưa chấm
                AI thì Nhận xét AI trống và Điểm theo luật trên dữ liệu import. Thiếu mô tả
                nhưng title còn ý: hệ thống vẫn ghi nhận điểm AI (tối thiểu 1 nếu model trả USELESS
                chỉ vì nội dung mỏng).
              </p>

              {/* Task Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-slate-900">
                <div className="p-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center bg-slate-50/50">
                  <div>
                    <h4 className="font-black text-xs uppercase tracking-widest text-slate-400">
                      BÁO CÁO CHI TIẾT: {currentEmployee?.name} • {employeeTasks.length} TASK
                    </h4>
                    <p className="mt-1 text-[10px] font-medium text-slate-500">
                      Chấm AI: đã chọn{' '}
                      <strong className="text-indigo-700">
                        {selectedForAiCount}/{scorableEmployeeTasks.length}
                      </strong>{' '}
                      phiếu (bỏ qua trùng hashtag / duplicate).
                    </p>
                    {isAiLoading && aiBatchProgress ? (
                      <p className="mt-1.5 text-[10px] font-bold text-indigo-600 leading-snug">
                        {aiBatchProgress}
                      </p>
                    ) : null}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isAiLoading ? (
                      <button
                        type="button"
                        onClick={() => aiAbortControllerRef.current?.abort()}
                        className="flex items-center gap-2 px-3 py-1.5 border-2 border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        title="Dừng sau lô hiện tại hoặc hủy request đang chạy; các phiếu đã chấm được giữ"
                      >
                        <StopCircle size={12} />
                        Hủy chấm
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleAiReview}
                      disabled={
                        isAiLoading ||
                        employeeTasks.length === 0 ||
                        selectedForAiCount === 0 ||
                        !isLlmConfigured(apiKey, aiEndpoint)
                      }
                      title={
                        employeeTasks.length === 0
                          ? 'Chưa có task cho nhân viên này'
                          : selectedForAiCount === 0
                            ? 'Tick chọn ít nhất một task ở cột AI'
                          : !isLlmConfigured(apiKey, aiEndpoint)
                            ? 'Cấu hình API endpoint tại tab Prompt AI'
                            : undefined
                      }
                      className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                    >
                      {isAiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      {isAiLoading
                        ? 'Đang chấm…'
                        : `Chấm AI (${selectedForAiCount} phiếu)`}
                  </button>
                  </div>
                </div>
                
                <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-2 py-4 w-11 text-center border-r border-slate-100">
                          <span className="sr-only">Chọn chấm AI</span>
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            checked={allScorableSelected}
                            ref={(el) => {
                              if (el) {
                                el.indeterminate =
                                  someScorableSelected && !allScorableSelected
                              }
                            }}
                            disabled={scorableEmployeeTasks.length === 0}
                            onChange={toggleSelectAllAi}
                            title="Chọn / bỏ chọn tất cả phiếu được phép chấm AI"
                          />
                        </th>
                        <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-24">Phân loại</th>
                        <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-28">Chính / Phụ</th>
                        <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]">Nội dung & Xtask</th>
                        <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-20">Độ khó</th>
                        <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[120px]">
                          Ghi chú
                        </th>
                        <th
                          className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]"
                          title="Nhận xét và chất lượng mô tả do model trả về khi chấm AI"
                        >
                          <span className="block">Nhận xét AI</span>
                          <span className="mt-1 block text-[8px] font-bold normal-case tracking-normal text-indigo-600">
                            (chấm AI)
                          </span>
                        </th>
                        <th
                          className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-24"
                          title="Điểm hiển thị theo kết quả chấm AI (và trừ muộn), không phải điểm thủ công trên sheet"
                        >
                          <span className="block">Điểm</span>
                          <span className="mt-1 block text-[8px] font-bold normal-case tracking-normal text-indigo-600">
                            (theo AI)
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {employeeTasks.map((task, idx) => {
                        const isNumericId = /^\d+$/.test(task.mainTaskId);
                        const taskUrl = isNumericId ? GoogleSheetService.getTaskUrl(task.mainTaskId, task.subTaskId) : null;
                        const rowKey = stableTaskRowKey(task);
                        const canAiScore = !task.isDuplicate;
                        
                        return (
                          <tr 
                            key={task.subTaskId + idx} 
                            className={`hover:bg-slate-50 transition-colors ${
                              task.isDuplicate 
                                ? 'bg-red-100/90 border-l-4 border-red-500 shadow-inner' 
                                : task.finalScore === 0 
                                  ? 'bg-red-50/40' 
                                  : ''
                            }`}
                          >
                            <td className="px-2 py-4 text-center border-r border-slate-50 align-middle">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30"
                                checked={canAiScore && selectedForAiKeys.has(rowKey)}
                                disabled={!canAiScore}
                                onChange={() => toggleOneAi(rowKey)}
                                title={
                                  canAiScore
                                    ? 'Gửi phiếu này khi bấm Chấm AI'
                                    : 'Không chấm AI (trùng / chặn)'
                                }
                              />
                            </td>
                            <td className="px-5 py-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                {taskUrl ? (
                                  <a 
                                    href={taskUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase transition-all hover:scale-105 active:scale-95 ${getTypeColor(task.type)} underline decoration-white/30 underline-offset-2`}
                                    title={`Mở Xtask: ${task.mainTaskId}`}
                                  >
                                    {task.type}
                                    <ExternalLink size={8} />
                                  </a>
                                ) : (
                                  <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase ${getTypeColor(task.type)}`}>
                                    {task.type}
                                  </span>
                                )}
                                {isNumericId && (
                                  <span className="text-[9px] font-bold text-slate-400 tracking-tighter tabular-nums leading-none">#{task.mainTaskId}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center border-x border-slate-50">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight ${
                                  task.xtaskRole === 'sub'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                                title={
                                  task.xtaskRole === 'sub'
                                    ? 'Task phụ: sub-task id khác task chính (cột export)'
                                    : 'Task chính: không có sub riêng hoặc sub trùng main'
                                }
                              >
                                {task.xtaskRole === 'sub' ? 'Phụ' : 'Chính'}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col gap-1.5 py-1">
                                <span className="text-xs font-bold leading-relaxed text-slate-800 whitespace-pre-wrap break-words">{task.title}</span>
                                <div className="flex items-start flex-col gap-1.5">
                                  <p className="text-[10px] text-slate-400 font-medium whitespace-pre-wrap break-words italic leading-relaxed" title={task.description}>
                                    {task.description || "—"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center border-x border-slate-50">
                              <span className={`inline-flex w-7 h-7 items-center justify-center rounded-lg text-xs font-black ${getDifficultyColor(task.difficulty)}`}>
                                {task.difficulty}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              {task.notes ? (
                                <div className="flex items-center gap-1.5 text-red-500 bg-red-50 px-2 py-1 rounded-lg border border-red-100">
                                  <AlertCircle size={12} className="shrink-0" />
                                  <span className="text-[10px] font-bold leading-snug">{task.notes}</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-300 font-bold italic">—</span>
                              )}
                            </td>
                            <td className="px-5 py-4 align-top border-l border-slate-100">
                              {task.aiComment ? (
                                <div
                                  className={`flex flex-col gap-2 px-3 py-2 rounded-lg border shadow-sm ${
                                    task.isAiFraud
                                      ? 'bg-red-50 text-red-800 border-red-200'
                                      : 'bg-indigo-50/90 text-indigo-900 border-indigo-100'
                                  }`}
                                >
                                  <div className="flex items-start gap-1.5">
                                    {task.isAiFraud ? (
                                      <AlertCircle size={14} className="shrink-0 text-red-600 mt-0.5" />
                                    ) : (
                                      <Cpu size={14} className="shrink-0 text-indigo-600 mt-0.5" />
                                    )}
                                    <span className="text-[11px] font-semibold leading-relaxed whitespace-pre-wrap break-words">
                                      {task.isAiFraud ? (
                                        <span className="font-black text-red-600 uppercase tracking-tight">
                                          Gian lận:{' '}
                                        </span>
                                      ) : null}
                                      {task.aiComment}
                                    </span>
                                  </div>
                                  {task.aiQualityScore !== undefined ? (
                                    <span
                                      className={`self-start text-[9px] font-black text-white px-2 py-0.5 rounded-full ${
                                        task.isAiFraud ? 'bg-red-600' : 'bg-indigo-600'
                                      }`}
                                    >
                                      Chất lượng mô tả: {task.aiQualityScore}/4
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-300 font-bold italic">—</span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="text-sm font-black text-slate-900">
                                {task.finalScore}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
              <UserCircle2 size={48} className="opacity-10 mb-4" />
              <p className="text-lg font-bold italic tracking-tighter">Chọn nhân viên để xem báo cáo chi tiết</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

function getTypeColor(type: string): string {
  switch (type) {
    case 'feature': return 'bg-indigo-600 text-white';
    case 'improvement': return 'bg-cyan-600 text-white';
    case 'bug': return 'bg-red-600 text-white';
    case 'maintenance': return 'bg-amber-100 text-amber-700';
    case 'leave': return 'bg-purple-100 text-purple-700';
    default: return 'bg-slate-100 text-slate-700';
  }
}

function getDifficultyColor(diff: number): string {
  switch (diff) {
    case 4: return 'bg-red-500 text-white';
    case 3: return 'bg-orange-500 text-white';
    case 1: return 'bg-emerald-500 text-white';
    default: return 'bg-blue-600 text-white';
  }
}