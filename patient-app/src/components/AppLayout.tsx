import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { IconBook, IconChevronLeft, IconHome, IconPill } from './icons'

// 共享 App 布局：顶部身份栏（含安全区）+ 底部导航（今日/指导/记录）。
// 按 UI_DESIGN §6：底部三个根页面，二级页面用顶栏返回。
interface AppLayoutProps {
  children: ReactNode
  title?: string
  showBack?: boolean
  showTabBar?: boolean
  /** 顶栏标题右侧的附加内容（如患者身份摘要） */
  headerExtra?: ReactNode
}

export default function AppLayout({ children, title, showBack = false, showTabBar = true, headerExtra }: AppLayoutProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const tabs = [
    { path: '/today', label: '今日', icon: IconHome },
    { path: '/guide', label: '指导', icon: IconBook },
    { path: '/medication', label: '记录', icon: IconPill },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* 顶部栏：安全区留白 + 内容 */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--line-soft)',
          paddingTop: 'var(--safe-top)',
        }}
      >
        <div
          style={{
            height: 'var(--appbar-h)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 12,
          }}
        >
          {showBack ? (
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'none', border: 'none', color: 'var(--brand-ink)',
                cursor: 'pointer', padding: '8px 4px', minWidth: 44,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label="返回"
            >
              <IconChevronLeft size={22} />
            </button>
          ) : null}

          <div style={{ flex: 1, minWidth: 0 }}>
            {title ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: showBack ? 'center' : 'flex-start' }}>
                <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {title}
                </span>
                {headerExtra}
              </div>
            ) : (
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>
                吸入治疗管理系统
              </div>
            )}
          </div>

          {!showBack && user && (
            <button
              onClick={logout}
              style={{
                background: 'none', border: 'none', color: 'var(--muted)',
                fontSize: 13, cursor: 'pointer', padding: '8px 4px',
              }}
              aria-label="退出"
            >
              退出
            </button>
          )}
        </div>
      </header>

      {/* 内容区 */}
      <main style={{ flex: 1, padding: '16px', paddingBottom: showTabBar ? 'calc(var(--tabbar-h) + var(--safe-bottom) + 16px)' : 'calc(var(--safe-bottom) + 16px)', maxWidth: 520, width: '100%', margin: '0 auto' }}>
        {children}
      </main>

      {/* 底部导航 */}
      {showTabBar && (
        <nav
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--surface)',
            borderTop: '1px solid var(--line-soft)',
            paddingBottom: 'var(--safe-bottom)',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', height: 'var(--tabbar-h)', maxWidth: 520, margin: '0 auto' }}>
            {tabs.map((t) => {
              const active = isActive(t.path)
              const Icon = t.icon
              return (
                <button
                  key={t.path}
                  onClick={() => navigate(t.path)}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    color: active ? 'var(--brand)' : 'var(--muted)',
                    borderTop: active ? '2px solid var(--brand)' : '2px solid transparent',
                  }}
                >
                  <Icon size={22} strokeWidth={active ? 2.1 : 1.8} />
                  <span style={{ fontSize: 12, fontWeight: active ? 600 : 400 }}>{t.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
