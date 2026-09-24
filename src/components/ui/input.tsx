import React from 'react';

// Komponen input bersama / Shared text input primitive
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({
  label,
  error,
  id,
  style,
  className = '',
  disabled,
  ...props
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--color-text-main)',
          }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '8px',
          border: error ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
          backgroundColor: disabled ? '#f9fafb' : '#ffffff',
          color: 'var(--color-text-main)',
          fontSize: '14px',
          outline: 'none',
          boxSizing: 'border-box',
          ...style,
        }}
        className={className}
        {...props}
      />
      {error && (
        <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>
          {error}
        </span>
      )}
    </div>
  );
}
