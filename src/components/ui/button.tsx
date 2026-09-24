import React from 'react';

// Komponen tombol bersama / Shared button primitive
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

export function Button({
  variant = 'primary',
  className = '',
  style,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--color-primary)',
      color: '#ffffff',
      border: 'none',
    },
    secondary: {
      backgroundColor: '#ffffff',
      color: 'var(--color-text-main)',
      border: '1px solid var(--color-border)',
    },
    danger: {
      backgroundColor: 'var(--color-danger)',
      color: '#ffffff',
      border: 'none',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--color-text-muted)',
      border: 'none',
    },
  };

  const baseStyle: React.CSSProperties = {
    padding: '10px 18px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.15s ease',
    ...variantStyles[variant],
    ...style,
  };

  return (
    <button
      data-variant={variant}
      style={baseStyle}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}
