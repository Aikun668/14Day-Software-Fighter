import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import './index.css'
import App from './App.tsx'
import { webTheme } from './styles/theme.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 两字按钮不自动插入空格，避免“登 录”“查 询”字距被撑开 */}
    <ConfigProvider locale={zhCN} theme={webTheme} button={{ autoInsertSpace: false }}>
      <App />
    </ConfigProvider>
  </StrictMode>,
)
