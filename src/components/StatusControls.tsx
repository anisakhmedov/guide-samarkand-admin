// Shared status-badge + action-button UI, originally local to GuestsPage.tsx — reused by
// ServiceRequestsPage.tsx for the same "badge + quick status transition buttons" pattern.
export function StatusCell({ value }: { value: string }) {
  const cls = value === 'approved' || value === 'open' || value === 'done' ? 'green' : value === 'rejected' || value === 'closed' ? 'red' : 'orange';
  return <span className={`badge ${cls}`}>{value}</span>;
}

export function ActionButtons({ options, current, onSelect }: { options: [string, string][]; current: string; onSelect: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
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
