import { Binary, Info, Send, Sparkles, Users } from 'lucide-react';
import React, { useState } from 'react';
import { useTask } from '../../hooks/useTask';

export const InputPage: React.FC = () => {
  const { fetchTasks } = useTask();
  const [url, setUrl] = useState('https://docs.google.com/spreadsheets/d/13pygqbhoT9tU-bokO28hXwkkRwsAs69oBGFIia-CH_4/edit?gid=2139411832');
  const [employeeText, setEmployeeText] = useState(`178701 - Nguyễn An Thới
165141 - Nguyễn Phương Thuỳ
182618 - Dương Ngọc Huy
259816 - Đào Hữu Thành
188204 - Nguyễn Minh Thao
194269 - Nguyễn Văn Ngọc
261611 - Trần Phúc Anh
179086 - Nguyễn Sinh Thành
125138 - Võ Thị Thùy Trang
265810 - Nguyễn Tiến Đạt`);
  const [hashtags] = useState('#REWORK\n#TRUNG_LAP');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const employeeList = employeeText.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const match = line.match(/^(\d+)[- ]*(.+)$/);
          return {
            id: match ? match[1].trim() : '',
            name: match ? match[2].trim() : line.trim()
          };
        })
        .filter(e => e.id);

      const blockedTags = hashtags.split('\n').filter(t => t.trim());
      
      await fetchTasks(url, employeeList, blockedTags);
      
      window.setActiveTab?.('output')
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tải dữ liệu từ Google Sheet',
      )
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-12 pb-20">
      <section className="space-y-4 max-w-3xl">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight">CẤU HÌNH DỮ LIỆU</h2>
        <p className="text-slate-500 font-medium text-lg leading-relaxed">
          Import phiếu từ Google Sheet. Điểm số và phân loại độ khó <strong>chỉ</strong> được gán sau khi bạn chạy AI trên tab Kết quả (cấu hình model/prompt tại tab <strong>Prompt AI</strong>).
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
         {/* Left: Settings */}
         <div className="space-y-6">
            {/* API Settings */}
            <div className="glass-card p-6 border-indigo-100 bg-indigo-50/30">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-200">
                        <Sparkles size={18} />
                     </div>
                     <h3 className="font-bold text-slate-800">Chấm điểm = AI</h3>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">AI</span>
               </div>
               
               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] text-indigo-500 font-bold bg-white/50 p-2 rounded-lg border border-indigo-50">
                     <Info size={12} />
                     <span>Nhập API key và chỉnh prompt tại tab Prompt AI (Google AI Studio / Gemini). Sau khi tải sheet, mở tab Kết quả → chọn nhân viên → <strong>Chấm AI</strong> (mặc định không chấm tự động để tránh 429; bật lại bằng VITE_AI_AUTO_SCORE=true trong .env).</span>
                  </div>
               </div>
            </div>

            {/* Sheet URL */}
            <div className="glass-card p-6 border-slate-200">
               <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-slate-900 text-white rounded-lg">
                     <Binary size={18} />
                  </div>
                  <h3 className="font-bold text-slate-800">Dữ liệu Google Sheet</h3>
               </div>
               <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CSV Export URL</label>
                  <input 
                    type="text" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-400 outline-none transition-all"
                  />
               </div>
            </div>
         </div>

         {/* Right: Employee & Action */}
         <div className="space-y-6">
            <div className="glass-card p-6 border-slate-200 bg-white shadow-xl shadow-slate-200/40">
               <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                     <Users size={18} />
                  </div>
                  <h3 className="font-bold text-slate-800">Danh sách nhân sự chấm điểm</h3>
               </div>
               <textarea 
                  value={employeeText}
                  onChange={(e) => setEmployeeText(e.target.value)}
                  className="w-full h-[220px] bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs font-mono leading-relaxed focus:bg-white focus:ring-2 focus:ring-slate-200 outline-none transition-all"
                  placeholder="ID - Tên nhân viên..."
               />
               
               {error && (
                 <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600">
                   <Info size={18} />
                   <p className="text-xs font-bold">{error}</p>
                 </div>
               )}

               <button 
                  onClick={handleStart}
                  disabled={isLoading}
                  className="w-full mt-6 bg-slate-900 hover:bg-black text-white rounded-2xl py-4 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl shadow-slate-300 transition-all active:scale-95 disabled:opacity-50"
               >
                  {isLoading ? 'Đang phân tích dữ liệu...' : (
                    <>
                      Tải dữ liệu từ Sheet
                      <Send size={18} />
                    </>
                  )}
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};