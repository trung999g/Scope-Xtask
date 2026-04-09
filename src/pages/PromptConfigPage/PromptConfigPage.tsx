import {
    DEFAULT_AI_MODEL,
    getResolvedDefaultAiPrompts,
} from '@/constants/aiPromptDefaults'
import { useTask } from '@/hooks/useTask'
import { pingOpenAiConnection } from '@/services/AIService'
import type { AiPromptConfig } from '@/types/aiPrompts'
import {
    describeBuiltInLlmKeySource,
    hasBuiltInLlmKey,
    isLlmConfigured,
    resolveLlmApiKey,
    sanitizeLlmEndpoint,
} from '@/utils/llmKey'
import {
    Activity,
    ExternalLink,
    Info,
    KeyRound,
    RotateCcw,
    Save,
} from 'lucide-react'
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
    aiEndpoint,
    setAiEndpoint,
    aiModel,
    setAiModel,
    aiPrompts,
    setAiPrompts,
  } = useTask()
  const [draft, setDraft] = useState<AiPromptConfig>(aiPrompts)
  const [modelDraft, setModelDraft] = useState(aiModel)
  const [endpointDraft, setEndpointDraft] = useState(aiEndpoint)
  const [keyDraft, setKeyDraft] = useState(() =>
    hasBuiltInLlmKey() ? '' : apiKey,
  )
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [pingLoading, setPingLoading] = useState(false)
  const [pingMessage, setPingMessage] = useState<string | null>(null)

  const updateField = (key: keyof AiPromptConfig, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const handleSave = () => {
    setAiPrompts(draft)
    setAiEndpoint(endpointDraft)
    setAiModel(modelDraft.trim() || DEFAULT_AI_MODEL)
    if (!hasBuiltInLlmKey()) {
      setApiKey(keyDraft.trim())
    }
    setSavedAt(new Date().toLocaleTimeString('vi-VN'))
  }

  const handleResetPrompts = () => {
    setDraft(getResolvedDefaultAiPrompts())
    setEndpointDraft('')
    setModelDraft(DEFAULT_AI_MODEL)
  }

  const handlePingOpenAi = async () => {
    setPingMessage(null)
    if (!isLlmConfigured(hasBuiltInLlmKey() ? '' : keyDraft, endpointDraft)) {
      setPingMessage(
        'Thiếu API endpoint. Vui lòng nhập URL endpoint trước khi kiểm tra kết nối.',
      )
      return
    }
    const key = resolveLlmApiKey(keyDraft).trim()
    const endpoint = sanitizeLlmEndpoint(endpointDraft)
    setPingLoading(true)
    try {
      const r = await pingOpenAiConnection(key, endpoint, modelDraft)
      if (r.ok) {
        setPingMessage('Kết nối OK — API trả 200 với model hiện tại.')
      } else {
        setPingMessage(r.message)
      }
    } finally {
      setPingLoading(false)
    }
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
            <span>OpenAI (ChatGPT API)</span>
          </div>
          <p className="mt-2 leading-relaxed">
            Gọi API kiểu OpenAI Chat Completions:{' '}
            <code className="rounded bg-white/80 px-1 break-all">
              {endpointDraft
                ? `${sanitizeLlmEndpoint(endpointDraft)}/chat/completions`
                : '(chưa nhập endpoint)'}
            </code>{' '}
            (lấy từ ô API endpoint bên dưới). Model mặc định{' '}
            <code className="rounded bg-white/80 px-1">gpt-4o</code>. Cloud OpenAI: tạo key tại{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline decoration-amber-600 underline-offset-2"
            >
              platform.openai.com
            </a>
            , hoặc cấu hình key build qua{' '}
            <code className="rounded bg-white/80 px-1">VITE_OPENAI_API_KEY</code> /{' '}
            <code className="rounded bg-white/80 px-1">VITE_AI_API_KEY</code> khi deploy.
            Nếu <strong>429</strong>: tăng <code className="rounded bg-white/80 px-1">VITE_AI_GLOBAL_GAP_MS</code> hoặc kiểm tra billing OpenAI.
          </p>
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-900">
          <KeyRound className="h-5 w-5 text-indigo-600 shrink-0" />
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-600">
            Lấy API key OpenAI
          </h3>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Đăng nhập OpenAI → mục API keys → <strong>Create new secret key</strong>. Key có dạng{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">sk-…</code>
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-700 transition-colors"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            Mở trang API keys
          </a>
          <a
            href="https://platform.openai.com/signup"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            Đăng ký tài khoản OpenAI
          </a>
          <a
            href="https://platform.openai.com/settings/organization/billing/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            Thanh toán và gói dùng
          </a>
        </div>
        <p className="text-xs text-slate-400 font-mono break-all">
          https://platform.openai.com/api-keys
        </p>
      </div>

      <div className="glass-card space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
          Kết nối
        </h3>
        {hasBuiltInLlmKey() ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-xs font-medium text-emerald-900 leading-relaxed">
            Đang lấy key từ biến môi trường build (
            <code className="rounded bg-white/80 px-1">
              {describeBuiltInLlmKeySource() ?? 'env'}
            </code>
            ) — không cần dán key vào ô dưới.
          </p>
        ) : null}
        <label className="block space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400">
            API endpoint (bắt buộc)
          </span>
          <input
            value={endpointDraft}
            onChange={(e) => setEndpointDraft(e.target.value)}
            placeholder="https://api.openai.com/v1 hoặc http://host/aicoding/v1"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <p className="text-xs text-slate-500">
            Chỉ dùng endpoint nhập tại đây; app không đọc base URL API từ biến môi trường.
          </p>
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400">
            API key OpenAI (sk-…)
          </span>
          <input
            type="password"
            autoComplete="off"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder={
              hasBuiltInLlmKey()
                ? 'Bỏ trống — đã có key dự án'
                : 'sk-...'
            }
            disabled={hasBuiltInLlmKey()}
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
            Mặc định: <code className="text-[10px]">{DEFAULT_AI_MODEL}</code>. Ví dụ:{' '}
            <code className="text-[10px]">gpt-4o-mini</code>. Model <code className="text-[10px]">gemini-*</code>{' '}
            trong ô này sẽ được <strong>bỏ qua</strong> và dùng <code className="text-[10px]">{DEFAULT_AI_MODEL}</code>. Nếu 429: tăng{' '}
            <code className="text-[10px]">VITE_AI_GLOBAL_GAP_MS</code>.
          </p>
        </label>

        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={pingLoading}
            onClick={() => void handlePingOpenAi()}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-bold text-indigo-900 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Activity className={`h-4 w-4 shrink-0 ${pingLoading ? 'animate-pulse' : ''}`} />
            {pingLoading ? 'Đang gọi API…' : 'Kiểm tra kết nối OpenAI'}
          </button>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Gửi một request tối thiểu (không dùng prompt chấm điểm). Dùng key trong ô trên hoặc key từ biến môi trường; model lấy theo ô Model ID.
          </p>
          {pingMessage ? (
            <p
              className={`rounded-xl px-3 py-2 text-xs font-medium leading-relaxed ${
                pingMessage.startsWith('Kết nối OK')
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              {pingMessage}
            </p>
          ) : null}
        </div>
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
