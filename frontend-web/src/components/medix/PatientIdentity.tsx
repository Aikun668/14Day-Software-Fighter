import type { ReactNode } from 'react'

export interface PatientIdentityProps {
  name: string
  avatar: ReactNode
}

export default function PatientIdentity({ name, avatar }: PatientIdentityProps) {
  return (
    <div className="ml-identity">
      {avatar}
      <span className="ml-identity-name">{name}</span>
    </div>
  )
}
