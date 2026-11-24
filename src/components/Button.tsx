import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  variant?: 'solid' | 'ghost';
  href?: string;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

const look = {
  solid: 'bg-copper text-ink hover:bg-cream',
  ghost: 'border border-white/15 text-ivory hover:border-white/40',
};

export function Button({ children, variant = 'solid', href, className = '', type = 'button', ...rest }: Props) {
  const cls = `inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition cursor-pointer ${look[variant]} ${className}`;
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
