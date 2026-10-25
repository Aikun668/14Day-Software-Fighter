import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import './index.css'
import App from './App.tsx'
import { webTheme } from './styles/theme.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 两字按钮不自动插入空格，避免“登 录”“查 询”字距被撑开 */}
    <ConfigProvider locale={zhCN} theme={webTheme} button={{ autoInsertSpace: false }}>
      {/* AntdApp 提供 message/notification 的上下文，静态 message 才能正确继承主题 */}
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
)
