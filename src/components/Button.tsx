import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'green' | 'red'
  full?: boolean
}

export default function Button({ variant = 'default', full = false, className = '', children, ...props }: ButtonProps) {
  const variantStyles = {
    default: 'bg-default hover:bg-default-hover active:bg-default-strong',
    green: 'bg-green hover:bg-green-hover active:bg-green-strong',
    red: 'bg-red hover:bg-red-hover active:bg-red-strong',
  }

  return (
    <button
      className={`font-bold px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 disabled:pointer-events-none ${full ? 'w-full' : ''} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
