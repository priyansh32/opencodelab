import clsx from 'clsx'
import { type StatusTone } from '@/utils/status'

interface StatusBadgeProps {
  label: string
  tone: StatusTone
  className?: string
}

const toneClassByVariant: Record<StatusTone, string> = {
  neutral: 'status-badge--neutral',
  info: 'status-badge--info',
  success: 'status-badge--success',
  warning: 'status-badge--warning',
  danger: 'status-badge--danger'
}

export const StatusBadge = ({ label, tone, className }: StatusBadgeProps) => {
  return (
    <span className={clsx('status-badge', toneClassByVariant[tone], className)}>{label}</span>
  )
}
