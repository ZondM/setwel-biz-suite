import React from 'react';
import { formatCurrency } from '../../core/numbering';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'; size?: 'sm' | 'md' | 'lg' }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-base' };
  const variants = {
    primary: 'bg-brand-green text-white hover:bg-brand-greenDark',
    secondary: 'bg-white text-brand-navy border border-gray-300 hover:bg-gray-50',
    ghost: 'bg-transparent text-brand-navy hover:bg-gray-100',
    danger: 'bg-status-overdue text-white hover:bg-red-700',
    gold: 'bg-brand-gold text-brand-navy hover:brightness-95'
  };
  return (
    <button type={type} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Card({ children, className = '', padded = true }: { children: React.ReactNode; className?: string; padded?: boolean }) {
  return <div className={`bg-white rounded-xl border border-gray-200 shadow-card ${padded ? 'p-4 md:p-5' : 'overflow-x-auto'} ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const statusStyles: Record<string, string> = {
  paid: 'bg-green-100 text-status-paid',
  overdue: 'bg-red-100 text-status-overdue',
  draft: 'bg-gray-100 text-status-draft',
  sent: 'bg-blue-100 text-status-sent',
  partial: 'bg-amber-100 text-status-partial',
  accepted: 'bg-green-100 text-status-paid',
  declined: 'bg-red-100 text-status-overdue',
  converted: 'bg-blue-100 text-status-sent'
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusStyles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export function StatCard({ label, value, sublabel, tone = 'default' }: { label: string; value: string; sublabel?: string; tone?: 'default' | 'good' | 'bad' | 'gold' }) {
  const toneColor = { default: 'text-brand-navy', good: 'text-brand-green', bad: 'text-status-overdue', gold: 'text-amber-600' }[tone];
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <span className={`font-display text-2xl font-bold ${toneColor}`}>{value}</span>
      {sublabel && <span className="text-xs text-gray-400">{sublabel}</span>}
    </Card>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {icon && <div className="mb-4 text-gray-300">{icon}</div>}
      <h3 className="font-display font-bold text-lg text-brand-navy mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">{description}</p>
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide = false }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-display font-bold text-lg text-brand-navy">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Close">
            ×
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-semibold text-brand-navy mb-1.5">
        {label} {required && <span className="text-status-overdue">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

const inputBase = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-brand-navy placeholder:text-gray-400 focus:border-brand-green focus:ring-1 focus:ring-brand-green';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} bg-white ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <span
        onClick={() => onChange(!checked)}
        className={`relative inline-block w-10 h-6 rounded-full transition-colors ${checked ? 'bg-brand-green' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
      {label && <span className="text-sm text-brand-navy">{label}</span>}
    </label>
  );
}

export function MoneyText({ amount, className = '' }: { amount: number; className?: string }) {
  return <span className={className}>{formatCurrency(amount)}</span>;
}

export function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center ml-1.5 align-middle">
      <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center cursor-help">?</span>
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block w-56 bg-brand-navy text-white text-xs rounded-lg p-2.5 z-10 shadow-lg">
        {text}
      </span>
    </span>
  );
}

export function Tabs({ tabs, active, onChange, className = '' }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void; className?: string }) {
  return (
    <div className="flex gap-1 border-b border-gray-200 mb-5 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
            active === t.id ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-brand-navy'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
