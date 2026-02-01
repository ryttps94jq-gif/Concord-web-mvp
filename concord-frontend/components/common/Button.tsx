'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'neon';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-lattice-void disabled:opacity-50 disabled:cursor-not-allowed';

    const variantStyles = {
      primary: 'bg-neon-blue text-white hover:bg-neon-blue/90 focus:ring-neon-blue',
      secondary: 'bg-lattice-elevated text-white hover:bg-lattice-surface focus:ring-neon-cyan',
      ghost: 'bg-transparent text-gray-300 hover:bg-lattice-elevated hover:text-white focus:ring-gray-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
      neon: 'bg-transparent border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 focus:ring-neon-cyan',
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          leftIcon && <span className="inline-flex">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && <span className="inline-flex">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
