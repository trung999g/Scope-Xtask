import type { ReactNode } from 'react'
import { APP_NAME } from '@/constants'
import { cn } from '@/utils/cn'

type LayoutProps = {
  children: ReactNode
  className?: string
}

export function Layout({ children, className }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
        </div>
      </header>
      <main className={cn('mx-auto w-full max-w-5xl flex-1 px-4 py-8', className)}>
        {children}
      </main>
    </div>
  )
}
