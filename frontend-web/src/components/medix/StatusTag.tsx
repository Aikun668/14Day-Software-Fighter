export interface StatusTagProps {
  kind: 'bound' | 'unbound'
  label: string
}

export default function StatusTag({ kind, label }: StatusTagProps) {
  return <span className={`ml-status ml-status-${kind}`}>{label}</span>
}
