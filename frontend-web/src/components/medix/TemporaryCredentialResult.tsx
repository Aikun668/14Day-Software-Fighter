import { useState } from 'react'
import { Input, Modal } from 'antd'

export interface TemporaryCredentialResultProps {
  open: boolean
  account: string
  temporaryPassword: string
  onDone: () => void
}

// 临时密码只留在这次弹窗的内存里。关闭由调用方清掉，不写存储、不进提示文案。
export default function TemporaryCredentialResult({
  open,
  account,
  temporaryPassword,
  onDone,
}: TemporaryCredentialResultProps) {
  const [copyNote, setCopyNote] = useState<string | null>(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword)
      setCopyNote('已复制')
    } catch {
      setCopyNote('复制失败，请手动选择后复制')
    }
  }

  return (
    <Modal
      title="临时密码"
      open={open}
      onCancel={onDone}
      onOk={onDone}
      okText="完成"
      cancelButtonProps={{ style: { display: 'none' } }}
      classNames={{ root: 'ml-shell ml-admin-modal' }}
      destroyOnHidden
      afterClose={() => setCopyNote(null)}
    >
      <div className="ml-credential">
        <p>请让本人立即修改密码。关闭后无法再次查看。</p>
        <div>
          <span className="ml-field-label">账号</span>
          <strong>{account}</strong>
        </div>
        <div>
          <span className="ml-field-label">临时密码</span>
          <Input.Password value={temporaryPassword} readOnly autoComplete="new-password" />
        </div>
        <button type="button" className="ml-text-btn" onClick={() => { void copy() }}>复制</button>
        {copyNote ? <p className="ml-hint">{copyNote}</p> : null}
      </div>
    </Modal>
  )
}
