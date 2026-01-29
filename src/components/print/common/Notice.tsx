import React from 'react'

type NoticeProps = {
  variant?: 'info' | 'warning'
  className?: string
  title?: string
  children: React.ReactNode
}

export const Notice: React.FC<NoticeProps> = ({
  variant = 'info',
  className = '',
  title,
  children,
}) => (
  <div className={['print-notice', `print-notice--${variant}`, className].filter(Boolean).join(' ')}>
    {title ? <strong className="print-notice__title">{title}</strong> : null}
    <div className="print-notice__body">{children}</div>
  </div>
)

export default Notice
