'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const sizeClasses = {
  sm: 'px-2 py-1 text-[11px]',
  md: 'px-3 py-2 text-xs',
  lg: 'px-4 py-3 text-sm',
};


export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium transition disabled:cursor-not-allowed disabled:opacity-40';

  // TODO: danger + ghost variants when we have time
  const variants = {
    default:
      'rounded-lg border border-white/10 bg-white/[0.04] text-secondary hover:border-white/20 hover:text-slate-100',
    primary:
      'rounded-lg border border-accent-warning/60 bg-accent-warning/10 font-semibold text-accent-warning hover:bg-accent-warning/20 disabled:hover:bg-accent-warning/10',
  };

  return (
    <button
      type="button"
      className={`${base} ${sizeClasses[size]} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
