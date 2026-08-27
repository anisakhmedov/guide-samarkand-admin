import { useEffect, useState } from 'react';
import { api, API_URL } from '../api/client';
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
          {!!p.photo && (
            <img
              src={(p.photo as string).startsWith('http') ? (p.photo as string) : `${API_URL}${p.photo}`}
              style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, marginTop: 6 }}
            />
          )}
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
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

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

  const saveComment = async (id: string, comment: string) => {
    await api.patch(`/admin/service-requests/${id}/comment`, { comment });
    load();
  };

  return (
    <div>
      <h1>Запросы гостей</h1>
      <p className="muted">Комментарий виден гостю в блоке «Мои заявки» на странице Опций.</p>
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
              <th>Комментарий гостю</th>
              <th>Когда</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const draft = commentDrafts[r._id] ?? r.adminComment ?? '';
              return (
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
                  <td style={{ minWidth: 200 }}>
                    <textarea
                      rows={2}
                      placeholder="Например: «принесём через 15 минут»"
                      value={draft}
                      onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [r._id]: e.target.value }))}
                      style={{ width: '100%', fontSize: '0.82rem' }}
                    />
                    <button className="btn small secondary" style={{ marginTop: 4 }} onClick={() => saveComment(r._id, draft)}>
                      Сохранить
                    </button>
                  </td>
                  <td className="muted">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {!loading && requests.length === 0 && <p className="muted">Пока нет запросов</p>}
    </div>
  );
}
