import { BookOpen, FileSpreadsheet, ListOrdered, MousePointer2 } from 'lucide-react'
import type React from 'react'

export const GuidePage: React.FC = () => {
  return (
    <div className="space-y-10 pb-20 max-w-5xl mx-auto">
      <section className="text-center space-y-4">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
          HƯỚNG DẪN SỬ DỤNG
        </h2>
        <p className="text-slate-500 font-medium">
          Tab <strong>Prompt AI</strong> (key + model + rubric) → tab <strong>Nhập Liệu</strong> (tải
          sheet) → tab <strong>Kết Quả</strong> (chọn nhân viên và bấm chấm AI). Điểm không còn tính
          thủ công từ sheet.
        </p>
      </section>

      <div className="grid gap-6">
        <GuideBlock
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title="1. Chuẩn bị Sheet"
          body={
            <>
              Dán URL Google Sheet có quyền truy cập. API key đặt tại tab Prompt AI (Google AI
              Studio). Đảm bảo cột CSV khớp{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">TaskContext</code>.
            </>
          }
        />
        <GuideBlock
          icon={<ListOrdered className="h-5 w-5" />}
          title="2. Danh sách nhân viên & hashtag"
          body={
            <>
              Mỗi dòng một nhân viên dạng <strong>Mã - Tên</strong>. Hashtag loại trừ (mỗi dòng
              một tag) giúp lọc task không muốn tính điểm.
            </>
          }
        />
        <GuideBlock
          icon={<MousePointer2 className="h-5 w-5" />}
          title="3. Chạy & xem kết quả"
          body={
            <>
              Bấm tải dữ liệu ở <strong>Nhập Liệu</strong>, mở <strong>Kết Quả</strong>, chọn nhân
              viên và <strong>Chấm AI</strong>. Tuỳ chỉnh rubric trong tab <strong>Prompt AI</strong>.
            </>
          }
        />
        <GuideBlock
          icon={<BookOpen className="h-5 w-5" />}
          title="4. Ghi chú"
          body={
            <>
              Lỗi 429: tăng <code className="text-[10px]">VITE_AI_GLOBAL_GAP_MS</code>, đổi model, hoặc
              tắt chấm tự động (mặc định chỉ chấm khi bấm nút ở Kết quả). Mở DevTools (Network) nếu cần
              xem chi tiết.
            </>
          }
        />
      </div>
    </div>
  )
}

function GuideBlock({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: React.ReactNode
}) {
  return (
    <div className="glass-card p-8 border-slate-200 bg-white/50 space-y-4">
      <div className="flex items-center gap-3 text-primary-600">
        <div className="rounded-lg bg-primary-100 p-2 text-primary-700">{icon}</div>
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
      </div>
      <div className="text-sm font-medium leading-relaxed text-slate-600">{body}</div>
    </div>
  )
}
