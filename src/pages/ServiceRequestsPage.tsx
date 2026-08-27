import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ServiceRequest, ServiceRequestStatus, ServiceRequestType } from '../api/types';
import { ActionButtons, StatusCell } from '../components/StatusControls';

const TYPE_LABELS: Record<ServiceRequestType, string> = {
  food_order: 'Питание в номер',
  drink_order: 'Напитки с бара',
  wake_up: 'Будильник',
  cleaning: 'Уборка',
  problem: 'Проблема',
  extension: 'Продление номера',
};

const STATUS_OPTIONS: [ServiceRequestStatus, string][] = [
  ['new', 'Новая'],
  ['in_progress', 'В работе'],
  ['done', 'Выполнена'],
  ['rejected', 'Отклонена'],
];

function PayloadSummary({ request }: { request: ServiceRequest }) {
  const p = request.payload || {};
  switch (request.type) {
    case 'food_order':
    case 'drink_order': {
      const items = (p.items as { name: string; qty: number; price: number }[]) || [];
      if (items.length === 0) return <span className="muted">—</span>;
      return (
        <>
          {items.map((it, i) => (
            <div key={i}>
              {it.name} × {it.qty} — {(it.price * it.qty).toLocaleString()} сум
            </div>
          ))}
        </>
      );
    }
    case 'wake_up':
      return (
        <>
          <div>Время: {(p.time as string) || '—'}</div>
          {!!p.note && <div className="muted">{p.note as string}</div>}
        </>
      );
    case 'cleaning':
      return (
        <>
          <div>Время: {(p.time as string) || 'в любое время'}</div>
          {!!p.note && <div className="muted">{p.note as string}</div>}
        </>
      );
    case 'extension':
      return (
        <>
          <div>Продлить до: {(p.until as string) || '—'}</div>
          {!!p.note && <div className="muted">{p.note as string}</div>}
        </>
      );
    case 'problem':
      return (
        <>
          <div>Категория: {(p.category as string) || '—'}</div>
          <div>{(p.description as string) || ''}</div>
        </>
      );
    default:
      return null;
  }
}

// Admin "Запросы гостей" queue for everything a guest sends from the guide's Options menu.
export function ServiceRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    setLoading(true);
    api
      .get<ServiceRequest[]>(`/admin/service-requests?${params.toString()}`)
      .then(setRequests)
      .finally(() => setLoading(false));
  };

  useEffect(load, [type, status]);

  const setRequestStatus = async (id: string, next: string) => {
    await api.patch(`/admin/service-requests/${id}/status`, { status: next });
    load();
  };

  return (
    <div>
      <h1>Запросы гостей</h1>
      <div className="toolbar">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Тип: все</option>
          {Object.entries(TYPE_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Статус: все</option>
          {STATUS_OPTIONS.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Гость</th>
              <th>Тип</th>
              <th>Детали</th>
              <th>Статус</th>
              <th>Когда</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r._id}>
                <td>{typeof r.guestId === 'object' && r.guestId ? `${r.guestId.name} №${r.guestId.roomNumber}` : '—'}</td>
                <td>{TYPE_LABELS[r.type]}</td>
                <td>
                  <PayloadSummary request={r} />
                </td>
                <td>
                  <StatusCell value={r.status} />
                  <ActionButtons options={STATUS_OPTIONS} current={r.status} onSelect={(v) => setRequestStatus(r._id, v)} />
                </td>
                <td className="muted">{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && requests.length === 0 && <p className="muted">Пока нет запросов</p>}
    </div>
  );
}
