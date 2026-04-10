import { BugIcon, Coffee, Scale, Target, Zap } from 'lucide-react';
import React from 'react';

export const RulesPage: React.FC = () => {
  return (
    <div className="space-y-12 pb-20 max-w-5xl mx-auto">
      {/* Rules Header */}
      <section className="text-center space-y-4">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">QUI TẮC CHẤM ĐIỂM</h2>
        <p className="text-slate-500 font-medium">Bảng quy chuẩn đánh giá năng suất và chất lượng công việc Team Frontend.</p>
      </section>

      {/* Main Rules Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Quality Controls */}
        <div className="glass-card p-8 border-slate-200 bg-white/50 space-y-6">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <Target size={20} />
             </div>
             <h3 className="text-xl font-bold text-slate-800">Kiểm soát Chất lượng</h3>
          </div>
          
          <div className="space-y-4">
            <RuleItem 
              title="Thiết quân luật (Strict Rules)" 
              description="Mọi task bắt buộc phải có mô tả rõ ràng (Nội dung phiếu). Nếu thiếu mô tả và tiêu đề ngắn (< 10 ký tự), task bị chấm 0 điểm ngay lập tức." 
            />
            <RuleItem 
              title="Điểm sàn (Min Score)" 
              description="Tất cả các task hợp lệ được tính ít nhất 1.0 điểm. Hệ thống tự động làm tròn về số nguyên (Integer)." 
            />
             <RuleItem 
              title="Điểm trần (Max Cap)" 
              description="Tối đa 4.0 điểm cho mỗi task đơn lẻ. Mọi điểm vượt quá sẽ bị hệ thống tự động cắt giảm." 
            />
          </div>
        </div>

        {/* Feature Weights */}
        <div className="glass-card p-8 border-slate-200 bg-white/50 space-y-6">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <Zap size={20} />
             </div>
             <h3 className="text-xl font-bold text-slate-800">Phân loại & Độ khó</h3>
          </div>
          <div className="space-y-4">
             <DifficultyRow level={4} label="Tối ưu / Optimize & kiến trúc / Perf hệ thống / Lib team" points={4} />
             <DifficultyRow level={3} label="Logic phức tạp / Integration / Review code & PR" points={3} />
             <DifficultyRow level={2} label="Logic cơ bản / State / API" points={2} />
             <DifficultyRow level={1} label="UI đơn giản / CSS / Typo" points={1} />
             <RuleItem
               title="Họp triển khai task"
               description="Phiếu họp/kickoff/handover triển khai (phối hợp, không tính như dev FE nặng): độ khó và điểm chấm trong khung 1–2; hệ thống và rubric AI không tự nâng chỉ vì từ “họp” nếu đúng loại này."
             />
             <RuleItem
               title="Review task"
               description="Rà soát spec/AC, review code, PR/MR, peer review: thường độ khó 3 và điểm 3 khi phạm vi rõ (nhiều file/PR); phạm vi hẹp có thể 2. Không gán 4 nếu không kèm optimize/kiến trúc. taskType thường maintenance (quy trình) trừ khi gắn deliverable dev rõ."
             />
             <RuleItem
               title="Support task"
               description="Hỗ trợ BA/QA/user, hỏi đáp kỹ thuật, debug hộ, chỉnh nhỏ theo ticket support: thường độ khó và điểm 1–2; taskType ưu tiên maintenance. Chỉ lên 3–4 khi phiếu mô tả thêm phần dev/tích hợp đáng kể (không còn support thuần)."
             />
          </div>
        </div>

        {/* Maintenance Rule */}
        <div className="glass-card p-8 border-slate-200 bg-white/50 space-y-6">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                <Scale size={20} />
             </div>
             <h3 className="text-xl font-bold text-slate-800">Duy trì (Maintenance)</h3>
          </div>
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
             <p className="text-sm font-medium text-amber-900">
               Tổng điểm Duy trì không được vượt quá <strong className="text-amber-600">20%</strong> tổng điểm hiệu suất (Feature + Bug). 
               Hệ thống sẽ tự động hạ điểm nếu tỷ lệ này vượt quá ngưỡng cho phép.
             </p>
          </div>
        </div>

         {/* Penalty Rule */}
         <div className="glass-card p-8 border-slate-200 bg-white/50 space-y-6">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <BugIcon size={20} />
             </div>
             <h3 className="text-xl font-bold text-slate-800">Quy tắc Phạt (Penalty)</h3>
          </div>
          <div className="space-y-3">
             <p className="text-sm text-slate-600 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                Duyệt task trễ: Phạt 2% tổng điểm mỗi ngày chậm trễ.
             </p>
             <p className="text-sm text-slate-600 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                Bug từ API nhưng assign FE: Phạt chiết khấu 50% điểm task bug đó.
             </p>
             <p className="text-sm text-slate-600 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                Thiếu mô tả chi tiết: Trừ thẳng 0 điểm.
             </p>
          </div>
        </div>
      </div>

      {/* Leave Note */}
      <div className="max-w-xl mx-auto p-6 bg-purple-50 rounded-2xl border border-purple-100 flex items-center gap-4">
         <div className="p-3 bg-white rounded-xl shadow-sm text-purple-600">
            <Coffee size={24} />
         </div>
         <div>
            <h4 className="font-bold text-purple-900 text-sm">Điểm Nghỉ phép & Support</h4>
            <p className="text-xs text-purple-600/80 font-medium leading-relaxed">
              Nhân sự nghỉ phép chính đáng (Sickness, AL, ...) sẽ được cộng <strong>6 (Giờ) / Ngày</strong> tương đương mức điểm hỗ trợ duy trì ổn định.
            </p>
         </div>
      </div>
    </div>
  );
};

const RuleItem = ({ title, description }: { title: string, description: string }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-2">
       <div className="w-2 h-2 rounded-full bg-slate-200" />
       <p className="text-sm font-bold text-slate-800">{title}</p>
    </div>
    <p className="text-xs text-slate-500 ml-4 font-medium leading-relaxed">{description}</p>
  </div>
);

const DifficultyRow = ({ level, label, points }: { level: number, label: string, points: number }) => (
  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
    <div className="flex items-center gap-3">
       <span className="w-6 h-6 flex items-center justify-center bg-slate-900 text-white rounded text-[10px] font-black">{level}</span>
       <span className="text-xs font-bold text-slate-600">{label}</span>
    </div>
    <span className="text-xs font-black text-indigo-600">{points}đ</span>
  </div>
);