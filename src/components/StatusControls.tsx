import { Search } from 'lucide-react';

// Shared status-badge + action-button UI used by the Guests and Service requests pages.

type Tone = 'green' | 'orange' | 'red' | 'blue' | '';

const TONE: Record<string, Tone> = {
  approved: 'green',
  open: 'green',
  done: 'green',
  rejected: 'red',
  closed: 'red',
  pending: 'orange',
  new: 'orange',
  in_progress: 'blue',
  not_sent: '',
  none: '',
};

export function StatusCell({ value, label }: { value: string; label?: string }) {
  return (
    <span className={`badge ${TONE[value] ?? ''}`}>
      <span className="dot" />
      {label ?? value}
    </span>
  );
}

export function ActionButtons({ options, current, onSelect }: { options: [string, string][]; current: string; onSelect: (v: string) => void }) {
  return (
    <div className="btn-row">
      {options
        .filter(([v]) => v !== current)
        .map(([v, label]) => (
          <button
            key={v}
            className="btn small secondary"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(v);
            }}
          >
            {label}
          </button>
        ))}
    </div>
  );
}

export function formatMoney(value: number) {
  return `${Math.round(value || 0).toLocaleString('ru-RU')} сум`;
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="search-box">
      <Search size={16} />
      <input className="input" type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
