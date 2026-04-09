import { Binary, FileUp, Info, Send, Sparkles, Users } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useTask } from '../../hooks/useTask';

export const InputPage: React.FC = () => {
  const { fetchTasks, importTasksFromCsvText } = useTask();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
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

  const parseEmployeeList = () =>
    employeeText
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const match = line.match(/^(\d+)[- ]*(.+)$/);
        return {
          id: match ? match[1].trim() : '',
          name: match ? match[2].trim() : line.trim(),
        };
      })
      .filter((e) => e.id);

  const parseBlockedTags = () => hashtags.split('\n').filter((t) => t.trim());

  const handleStart = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const employeeList = parseEmployeeList();
      const blockedTags = parseBlockedTags();

      await fetchTasks(url, employeeList, blockedTags);

      window.setActiveTab?.('output');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tải dữ liệu từ Google Sheet',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickCsvFile = () => fileInputRef.current?.click();

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsLoading(true);
    setError(null);
    try {
      const text = await file.text();
      const employeeList = parseEmployeeList();
      const blockedTags = parseBlockedTags();
      await importTasksFromCsvText(text, employeeList, blockedTags, file.name);
      window.setActiveTab?.('output');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không đọc được file CSV',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-12 pb-20">
      <section className="space-y-4 max-w-3xl">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight">CẤU HÌNH DỮ LIỆU</h2>
        <p className="text-slate-500 font-medium text-lg leading-relaxed">
          Import phiếu từ <strong>Google Sheet</strong> hoặc file <strong>CSV</strong> đã export (cùng bố cục cột).
          Chấm điểm dùng API <strong>ChatGPT</strong> (OpenAI), mặc định <strong>gpt-4o</strong> — key/model ở tab{' '}
          <strong>Prompt AI</strong>; tab Kết quả bấm <strong>Chấm AI</strong> (hoặc bật <code className="text-xs bg-slate-100 px-1 rounded">VITE_AI_AUTO_SCORE</code>).
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
                     <span>
                       Tab Prompt AI: nhập <code className="text-[9px]">sk-…</code> (ghi đè) hoặc để trống để dùng env{' '}
                       <code className="text-[9px]">VITE_OPENAI_API_KEY</code> /{' '}
                       <code className="text-[9px]">VITE_AI_API_KEY</code>; model mặc định{' '}
                       <code className="text-[9px]">gpt-4o</code>. Sau khi import → tab Kết quả → <strong>Chấm AI</strong>.
                     </span>
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
                    placeholder="https://docs.google.com/spreadsheets/d/13pygqbhoT9tU-bokO28hXwkkRwsAs69oBGFIia-CH_4/edit?gid=2139411832"
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-400 outline-none transition-all"
                  />
               </div>
               <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleCsvFileChange}
               />
               <button
                  type="button"
                  onClick={handlePickCsvFile}
                  disabled={isLoading}
                  className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white py-3 text-xs font-bold text-slate-600 hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-800 transition-all disabled:opacity-50"
               >
                  <FileUp size={16} />
                  Hoặc chọn file CSV từ máy (UTF-8)
               </button>
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