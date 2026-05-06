import type { HTMLAttributes, PropsWithChildren } from 'react'

interface CardProps extends PropsWithChildren<HTMLAttributes<HTMLDivElement>> {}

export default function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div className={`bg-white px-8 py-8 rounded-xl drop-shadow-lg ${className}`} {...props}>
      {children}
    </div>
  )
}
