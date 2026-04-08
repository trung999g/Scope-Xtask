import { BarChart3, Binary, HelpCircle, Type as InputIcon, Layout, MessageSquareText, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { TaskProvider } from './contexts/TaskProvider'
import { GuidePage } from './pages/GuidePage/GuidePage'
import { InputPage } from './pages/InputPage/InputPage'
import { OutputPage } from './pages/OutputPage/OutputPage'
import { PromptConfigPage } from './pages/PromptConfigPage/PromptConfigPage'
import { RulesPage } from './pages/RulesPage/RulesPage'

function App() {
  const [activeTab, setActiveTab] = useState<
    'input' | 'output' | 'rules' | 'guide' | 'prompts'
  >('input')

  // Global hack to allow programmatic tab changes
  useEffect(() => {
    window.setActiveTab = setActiveTab
    return () => {
      delete window.setActiveTab
    }
  }, [])

  const renderContent = () => {
    switch (activeTab) {
      case 'input': return <InputPage />;
      case 'output': return <OutputPage />;
      case 'rules': return <RulesPage />;
      case 'guide': return <GuidePage />;
      case 'prompts': return <PromptConfigPage />;
      default: return <InputPage />;
    }
  }

  return (
    <TaskProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-primary-100 selection:text-primary-900">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary-200 group transition-transform hover:scale-110">
                <Binary size={28} className="group-hover:rotate-12 transition-transform" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-800 leading-none">XTASK SCORER</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-1.5 leading-none">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> 
                  Premium Dashboard • Web Team
                </p>
              </div>
            </div>

            <nav className="flex items-center gap-1 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-100 shadow-inner overflow-x-auto max-w-[680px]">
              <TabButton 
                active={activeTab === 'input'} 
                onClick={() => setActiveTab('input')} 
                icon={<InputIcon size={16} />} 
                label="Nhập Liệu" 
              />
              <TabButton 
                active={activeTab === 'output'} 
                onClick={() => setActiveTab('output')} 
                icon={<BarChart3 size={16} />} 
                label="Kết Quả" 
              />
              <TabButton 
                active={activeTab === 'rules'} 
                onClick={() => setActiveTab('rules')} 
                icon={<ShieldCheck size={16} />} 
                label="Quy Tắc" 
              />
              <TabButton 
                active={activeTab === 'prompts'} 
                onClick={() => setActiveTab('prompts')} 
                icon={<MessageSquareText size={16} />} 
                label="Prompt AI" 
              />
              <TabButton 
                active={activeTab === 'guide'} 
                onClick={() => setActiveTab('guide')} 
                icon={<HelpCircle size={16} />} 
                label="Hướng Dẫn" 
              />
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <Layout size={16} className="text-slate-400" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-800 leading-none">ADMIN</p>
                  <p className="text-[8px] font-bold text-slate-400 leading-none mt-1 uppercase">Frontend Architect</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8">
          <div className="mt-4">
            {renderContent()}
          </div>
        </main>

        {/* Footer */}
        <footer className="py-12 border-t border-slate-100 bg-white">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
               <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-xs">A.G</div>
               <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Ants Gravity • Task Scoring System</p>
            </div>
            <p className="text-slate-300 text-[10px] font-bold uppercase">Build with ♥ for TGDD Web Team</p>
          </div>
        </footer>
      </div>
    </TaskProvider>
  )
}

type TabButtonProps = {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
        active 
          ? 'bg-white text-primary-600 shadow-md shadow-slate-200' 
          : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}


export default App