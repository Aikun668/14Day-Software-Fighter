import { useState } from 'react'
import { IconAlert } from './icons'

interface Props { src: string | null; stepNo: number }

// 步骤图示（DEMO-未审核线稿）。加载失败时只显示提示，不影响文字与自检提交。
export default function GuideStepImage({ src, stepNo }: Props) {
  const [failed, setFailed] = useState(false)
  if (!src) return null

  return (
    <div style={{ maxWidth: 520, marginTop: 12 }}>
      {failed ? (
        <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconAlert size={15} color="var(--muted)" />
          <span>图示暂不可用，请参考上方文字</span>
        </div>
      ) : (
        <img
          src={src}
          alt={`步骤 ${stepNo} 图示（DEMO-未审核）`}
          onError={() => setFailed(true)}
          style={{ display: 'block', width: '100%', borderRadius: 10 }}
        />
      )}
    </div>
  )
}
