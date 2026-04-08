import {
    DEFAULT_AI_MODEL,
    DEFAULT_AI_PROMPTS,
} from '@/constants/aiPromptDefaults'
import { useTask } from '@/hooks/useTask'
import { hasBuiltInGeminiKey } from '@/utils/geminiKey'
import type { AiPromptConfig } from '@/types/aiPrompts'
import { Info, RotateCcw, Save } from 'lucide-react'
import React, { useState } from 'react'

const FIELD_META: { key: keyof AiPromptConfig; label: string; hint: string }[] =
  [
    {
      key: 'roleAndMission',
      label: 'Vai trò & nhiệm vụ',
      hint: 'Tone và mục tiêu tổng thể của AI khi chấm.',
    },
    {
      key: 'difficultyRubric',
      label: 'Rubric độ khó (1–4)',
      hint: 'Tiêu chí gắn difficulty; càng chi tiết AI càng ít “lệch”.',
    },
    {
      key: 'taskTypeRubric',
      label: 'Phân loại taskType',
      hint: 'feature / bug / maintenance / leave / …',
    },
    {
      key: 'scoringRubric',
      label: 'Quy tắc điểm (0–4)',
      hint: 'Ánh xạ difficulty + chất lượng mô tả → finalScore.',
    },
    {
      key: 'integrityRules',
      label: 'Gian lận & trạng thái',
      hint: 'FRAUD / USELESS / VAGUE / OK.',
    },
    {
      key: 'jsonOutputContract',
      label: 'Hợp đồng JSON đầu ra',
      hint: 'Giữ nguyên tên trường id, taskType, difficulty, finalScore, status, aiQualityScore, aiComment trừ khi đổi code parse.',
    },
  ]

export const PromptConfigPage: React.FC = () => {
  const {
    apiKey,
    setApiKey,
    aiModel,
    setAiModel,
    aiPrompts,
    setAiPrompts,
  } = useTask()
  const [draft, setDraft] = useState<AiPromptConfig>(aiPrompts)
  const [modelDraft, setModelDraft] = useState(aiModel)
  const [keyDraft, setKeyDraft] = useState(() =>
    hasBuiltInGeminiKey() ? '' : apiKey,
  )
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const updateField = (key: keyof AiPromptConfig, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const handleSave = () => {
    setAiPrompts(draft)
    setAiModel(modelDraft.trim() || DEFAULT_AI_MODEL)
    if (!hasBuiltInGeminiKey()) {
      setApiKey(keyDraft.trim())
    }
    setSavedAt(new Date().toLocaleTimeString('vi-VN'))
  }

  const handleResetPrompts = () => {
    setDraft(DEFAULT_AI_PROMPTS)
    setModelDraft(DEFAULT_AI_MODEL)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-20">
      <section className="space-y-3">
        <h2 className="text-3xl font-black tracking-tight text-slate-900">
          PROMPT — CẤU HÌNH AI
        </h2>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <div className="flex gap-2 font-bold">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Về NotebookLM và key miễn phí</span>
          </div>
          <p className="mt-2 leading-relaxed">
            <strong>NotebookLM</strong> hiện{' '}
            <strong>không cung cấp API key</strong> kiểu dán vào web app cá nhân.
            Tab này dùng <strong>Google AI Studio</strong> (Gemini API — thường có
            hạn mức miễn phí): tạo key tại{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline decoration-amber-600 underline-offset-2"
            >
              aistudio.google.com/apikey
            </a>
            . Nếu lỗi <strong>429 / quota</strong>: ưu tiên{' '}
            <code className="rounded bg-white/80 px-1">gemini-2.5-flash-lite</code> (chính) và{' '}
            <code className="rounded bg-white/80 px-1">gemini-2.5-flash</code> (dự phòng), tăng{' '}
            <code className="rounded bg-white/80 px-1">VITE_AI_GLOBAL_GAP_MS</code>, hoặc bật billing.
          </p>
        </div>
      </section>

      <div className="glass-card space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
          Kết nối
        </h3>
        {hasBuiltInGeminiKey() ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-xs font-medium text-emerald-900 leading-relaxed">
            Đang dùng <strong>key chung</strong> từ biến môi trường{' '}
            <code className="rounded bg-white/80 px-1">VITE_GEMINI_API_KEY</code> (build /
            Vercel). Không cần dán key vào ô dưới; phiên làm việc này dùng mặc định đó.
          </p>
        ) : null}
        <label className="block space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400">
            API key (Google AI Studio) — chỉ khi không cấu hình VITE_GEMINI_API_KEY
          </span>
          <input
            type="password"
            autoComplete="off"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder={
              hasBuiltInGeminiKey() ? 'Bỏ trống — đã có key dự án' : 'AIza...'
            }
            disabled={hasBuiltInGeminiKey()}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400">
            Model ID
          </span>
          <input
            value={modelDraft}
            onChange={(e) => setModelDraft(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <p className="text-xs text-slate-500">
            Mặc định: {DEFAULT_AI_MODEL}. Model cũ (<code className="text-[10px]">gemini-2.0-flash*</code>) trong
            trình duyệt sẽ được nâng tự động khi tải lại. Nếu vẫn 429: tăng{' '}
            <code className="text-[10px]">VITE_AI_GLOBAL_GAP_MS</code> (vd. 12000) trong{' '}
            <code className="text-[10px]">.env</code>.
          </p>
        </label>
      </div>

      <div className="space-y-6">
        {FIELD_META.map(({ key, label, hint }) => (
          <div
            key={key}
            className="glass-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-800">{label}</span>
              <span className="block text-xs text-slate-500">{hint}</span>
              <textarea
                value={draft[key]}
                onChange={(e) => updateField(key, e.target.value)}
                rows={key === 'jsonOutputContract' ? 8 : 10}
                className="w-full rounded-xl border border-slate-100 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Rubric mặc định luôn theo bản trong code; chỉnh sửa ở đây chỉ có hiệu sau khi bấm{' '}
        <strong>Lưu</strong> trong phiên hiện tại (tải lại trang sẽ về mặc định gốc).
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-black"
        >
          <Save className="h-4 w-4" />
          Lưu cấu hình
        </button>
        <button
          type="button"
          onClick={handleResetPrompts}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <RotateCcw className="h-4 w-4" />
          Khôi phục prompt + model mặc định
        </button>
        {savedAt && (
          <span className="text-xs font-bold text-emerald-600">
            Đã lưu lúc {savedAt}
          </span>
        )}
      </div>
    </div>
  )
}
