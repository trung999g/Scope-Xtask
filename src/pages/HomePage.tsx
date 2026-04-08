import { motion } from 'framer-motion'
import { ClipboardList } from 'lucide-react'
import { Layout } from '@/components/Layout'

export function HomePage() {
  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            <ClipboardList className="h-6 w-6" aria-hidden />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">
              Công cụ chấm điểm Xtask
            </h1>
            <p className="max-w-prose text-sm text-slate-600 dark:text-slate-400">
              Cấu trúc dự án đã sẵn sàng: import CSV (Papa Parse), tìm kiếm mờ (Fuse),
              gọi API (Axios) hoặc hỗ trợ AI (Gemini). Thêm flow chấm điểm trong{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">
                pages/
              </code>{' '}
              và services tương ứng.
            </p>
          </div>
        </div>
      </motion.div>
    </Layout>
  )
}
