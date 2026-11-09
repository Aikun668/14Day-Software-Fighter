import neutralUrl from '../../assets/medix/avatar-neutral.svg'

export interface PatientAvatarProps {
  name: string
  patientId: string
  src?: string | null
  demoSrc?: string | null
  /** 只有显式演示模式才允许使用 demoSrc。生产患者没有 src 时一律中性图标。 */
  demo?: boolean
  size?: 'sm' | 'md'
}

export default function PatientAvatar({
  name,
  patientId,
  src,
  demoSrc,
  demo = false,
  size = 'md',
}: PatientAvatarProps) {
  const real = src?.trim() ? src : null
  const staged = demo && demoSrc?.trim() ? demoSrc : null
  const image = real || staged || neutralUrl

  return (
    <span
      className={`ml-avatar ml-avatar-${size}`}
      data-patient-id={patientId}
      data-name={name}
      aria-hidden="true"
    >
      <img src={image} alt="" />
    </span>
  )
}
