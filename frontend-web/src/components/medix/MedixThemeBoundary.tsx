import type { ReactNode } from 'react'
import { App as AntdApp, ConfigProvider } from 'antd'
import { medixTheme } from '../../styles/medix-theme.ts'

export type MedixScope = 'shell' | 'auth' | 'page'

// 局部 ConfigProvider。浮层门户挂上同一作用域 class，主题变量才进得了 body 下的弹层。
// 不在这里改全局 theme.ts，也不写裸的 .ant-* 规则。
export default function MedixThemeBoundary({
  children,
  scope,
}: {
  children: ReactNode
  scope: MedixScope
}) {
  const scopeClass = scope === 'auth' ? 'ml-auth' : scope === 'page' ? 'ml-page' : 'ml-shell'
  const frameClass = scope === 'shell' ? 'ml-shell ml-frame' : scopeClass
  const overlay = { root: scopeClass }

  return (
    <ConfigProvider
      theme={medixTheme}
      button={{ autoInsertSpace: false }}
      modal={{ classNames: overlay }}
      drawer={{ classNames: overlay }}
      select={{ classNames: { popup: overlay } }}
      dropdown={{ classNames: overlay }}
      tooltip={{ classNames: overlay }}
      popover={{ classNames: overlay }}
      message={{ classNames: overlay }}
    >
      <AntdApp>
        <div className={frameClass}>{children}</div>
      </AntdApp>
    </ConfigProvider>
  )
}
