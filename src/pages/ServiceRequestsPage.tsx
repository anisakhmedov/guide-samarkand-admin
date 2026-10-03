import { useMemo, useState } from 'react';
import { Banknote, CheckCircle2, ChevronRight, Clock3, Loader2, RotateCw, Wallet } from 'lucide-react';
import { api, API_URL, sameJson } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { ServiceRequest, ServiceRequestStatus, ServiceRequestType } from '../api/types';
import { Drawer } from '../components/Drawer';
import { SearchBox, StatusCell, formatDateTime, formatMoney } from '../components/StatusControls';

const TYPE_LABELS: Record<ServiceRequestType, string> = {
  food_order: 'Питание в номер',
  drink_order: 'Напитки с бара',
  hookah: 'Кальян',
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
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS) as Record<ServiceRequestStatus, string>;

const PROBLEM_CATEGORY: Record<string, string> = {
  noise: 'Шум',
  ac: 'Кондиционер / отопление',
  plumbing: 'Сантехника',
  cleanliness: 'Чистота номера',
  other: 'Другое',
};

const PAYMENT_METHOD: Record<string, string> = { cash: 'Наличные', card: 'Терминал' };

const PAID_TYPES: ServiceRequestType[] = ['food_order', 'drink_order', 'hookah'];
const POLL_MS = 15000;

interface OrderLine {
  name: string;
  qty: number;
  price: number;
}

const isPaidType = (r: ServiceRequest) => PAID_TYPES.includes(r.type);

function orderLines(r: ServiceRequest): OrderLine[] {
  const p = r.payload || {};
  if (r.type === 'hookah') return [{ name: 'Кальян', qty: Number(p.qty) || 1, price: Number(p.price) || 0 }];
  return Array.isArray(p.items) ? (p.items as OrderLine[]) : [];
}

// Requests created before server-side pricing have total = 0 — fall back to the line items.
function requestTotal(r: ServiceRequest) {
  if (r.total > 0) return r.total;
  return orderLines(r).reduce((sum, it) => sum + it.price * it.qty, 0);
}

function guestOf(r: ServiceRequest) {
  return typeof r.guestId === 'object' && r.guestId ? r.guestId : null;
}

function shortSummary(r: ServiceRequest) {
  const p = r.payload || {};
  switch (r.type) {
    case 'food_order':
    case 'drink_order': {
      const lines = orderLines(r);
      const count = lines.reduce((s, it) => s + it.qty, 0);
      return lines.length ? `${lines[0].name}${lines.length > 1 ? ` и ещё ${lines.length - 1}` : ''} · ${count} шт.` : '—';
    }
    case 'hookah':
      return `${p.qty || 1} шт.${p.time ? ` · к ${p.time}` : ''}`;
    case 'wake_up':
      return `Время: ${p.time || '—'}`;
    case 'cleaning':
      return `Время: ${p.time || 'любое'}`;
    case 'extension':
      return `До: ${p.until || '—'}`;
    case 'problem':
      return PROBLEM_CATEGORY[p.category as string] || (p.category as string) || '—';
    default:
      return '';
  }
}

function PaidBadge({ request }: { request: ServiceRequest }) {
  if (!isPaidType(request)) return <span className="muted">—</span>;
  return request.paid ? (
    <span className="badge green">
      <CheckCircle2 size={12} /> Оплачено
    </span>
  ) : (
    <span className="badge red">
      <Wallet size={12} /> Не оплачено
    </span>
  );
}

// Admin "Запросы гостей" queue for everything a guest sends from the guide's Options menu.
export function ServiceRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'' | ServiceRequestStatus>('');
  const [type, setType] = useState<'' | ServiceRequestType>('');
  const [payment, setPayment] = useState<'' | 'paid' | 'unpaid'>('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    return api
      .get<ServiceRequest[]>('/admin/service-requests')
      .then((list) => setRequests((prev) => (sameJson(prev, list) ? prev : list)))
      .finally(() => setLoading(false));
  };

  usePolling(() => load(requests.length > 0), POLL_MS);

  // PATCH responses aren't populated with the guest, so merge only the fields that changed.
  const patchLocal = (id: string, changes: Partial<ServiceRequest>) =>
    setRequests((prev) => prev.map((r) => (r._id === id ? { ...r, ...changes } : r)));

  const setRequestStatus = async (id: string, next: ServiceRequestStatus) => {
    const updated = await api.patch<ServiceRequest>(`/admin/service-requests/${id}/status`, { status: next });
    patchLocal(id, { status: updated.status });
  };

  const setPaid = async (id: string, paid: boolean) => {
    const updated = await api.patch<ServiceRequest>(`/admin/service-requests/${id}/paid`, { paid });
    patchLocal(id, { paid: updated.paid, paidAt: updated.paidAt });
  };

  const saveComment = async (id: string, comment: string) => {
    const updated = await api.patch<ServiceRequest>(`/admin/service-requests/${id}/comment`, { comment });
    patchLocal(id, { adminComment: updated.adminComment });
  };

  const byFilters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (type && r.type !== type) return false;
      if (payment === 'paid' && !(isPaidType(r) && r.paid)) return false;
      if (payment === 'unpaid' && !(isPaidType(r) && !r.paid)) return false;
      if (q) {
        const g = guestOf(r);
        const hay = `${g?.name ?? ''} ${g?.roomNumber ?? ''} ${g?.phone ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requests, type, payment, search]);

  const visible = status ? byFilters.filter((r) => r.status === status) : byFilters;

  const statusCount = (s: ServiceRequestStatus) => byFilters.filter((r) => r.status === s).length;

  const unpaid = requests.filter((r) => isPaidType(r) && !r.paid && r.status !== 'rejected');
  const unpaidSum = unpaid.reduce((sum, r) => sum + requestTotal(r), 0);
  const paidSum = requests.filter((r) => isPaidType(r) && r.paid).reduce((sum, r) => sum + requestTotal(r), 0);

  const opened = requests.find((r) => r._id === openId) || null;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Запросы гостей</h1>
          <p className="muted">Нажмите на запрос, чтобы открыть детали заказа, сменить статус или отметить оплату.</p>
        </div>
        <button className="btn secondary" onClick={() => load()} disabled={loading}>
          <RotateCw /> Обновить
        </button>
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <div className="stat-tile__icon orange">
            <Clock3 size={18} />
          </div>
          <div className="stat-tile__body">
            <div className="stat-tile__value">{requests.filter((r) => r.status === 'new').length}</div>
            <div className="stat-tile__label">Новые</div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__icon blue">
            <Loader2 size={18} />
          </div>
          <div className="stat-tile__body">
            <div className="stat-tile__value">{requests.filter((r) => r.status === 'in_progress').length}</div>
            <div className="stat-tile__label">В работе</div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__icon red">
            <Wallet size={18} />
          </div>
          <div className="stat-tile__body">
            <div className="stat-tile__value" title={formatMoney(unpaidSum)}>
              {formatMoney(unpaidSum)}
            </div>
            <div className="stat-tile__label">Ждут оплаты · {unpaid.length}</div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__icon">
            <Banknote size={18} />
          </div>
          <div className="stat-tile__body">
            <div className="stat-tile__value" title={formatMoney(paidSum)}>
              {formatMoney(paidSum)}
            </div>
            <div className="stat-tile__label">Оплачено всего</div>
          </div>
        </div>
      </div>

      <div className="seg-scroll" style={{ marginBottom: 12 }}>
        <div className="seg">
          <button className={status === '' ? 'active' : ''} onClick={() => setStatus('')}>
            Все <span className="count">{byFilters.length}</span>
          </button>
          {STATUS_OPTIONS.map(([code, label]) => (
            <button key={code} className={status === code ? 'active' : ''} onClick={() => setStatus(code)}>
              {label} <span className="count">{statusCount(code)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar">
        <SearchBox value={search} onChange={setSearch} placeholder="Поиск: имя, комната, телефон" />
        <select value={type} onChange={(e) => setType(e.target.value as ServiceRequestType | '')}>
          <option value="">Тип: все</option>
          {Object.entries(TYPE_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <select value={payment} onChange={(e) => setPayment(e.target.value as typeof payment)}>
          <option value="">Оплата: все</option>
          <option value="unpaid">Не оплачено</option>
          <option value="paid">Оплачено</option>
        </select>
      </div>

      {loading && requests.length === 0 ? (
        <p className="muted">Загрузка…</p>
      ) : (
        <div className="table-wrap responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Гость / запрос</th>
                <th>Статус</th>
                <th className="num">Сумма</th>
                <th>Оплата</th>
                <th>Когда</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const g = guestOf(r);
                return (
                  <tr key={r._id} className={`clickable ${r.status === 'new' ? 'is-new' : ''}`} onClick={() => setOpenId(r._id)}>
                    <td className="primary">
                      <div className="cell-title">
                        {TYPE_LABELS[r.type]}
                        {g && <span className="muted"> · №{g.roomNumber}</span>}
                      </div>
                      <div className="cell-sub wrap-anywhere">
                        {g ? g.name : 'Гость удалён'} — {shortSummary(r)}
                      </div>
                    </td>
                    <td className="aside">
                      <StatusCell value={r.status} label={STATUS_LABEL[r.status]} />
                    </td>
                    <td className="num" data-label="Сумма">
                      {isPaidType(r) ? <span className="money">{formatMoney(requestTotal(r))}</span> : <span className="muted">—</span>}
                    </td>
                    <td data-label="Оплата" className={isPaidType(r) ? '' : 'hide-mobile'}>
                      <PaidBadge request={r} />
                    </td>
                    <td className="nowrap muted" data-label="Создан">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="actions hide-mobile">
                      <ChevronRight size={18} color="var(--color-text-soft)" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && <div className="table-empty">Запросов не найдено</div>}
        </div>
      )}

      {opened && (
        <RequestDrawer
          key={opened._id}
          request={opened}
          onClose={() => setOpenId(null)}
          onStatus={(s) => setRequestStatus(opened._id, s)}
          onPaid={(p) => setPaid(opened._id, p)}
          onComment={(c) => saveComment(opened._id, c)}
        />
      )}
    </div>
  );
}

function RequestDrawer({
  request: r,
  onClose,
  onStatus,
  onPaid,
  onComment,
}: {
  request: ServiceRequest;
  onClose: () => void;
  onStatus: (s: ServiceRequestStatus) => Promise<void>;
  onPaid: (paid: boolean) => Promise<void>;
  onComment: (comment: string) => Promise<void>;
}) {
  const [comment, setComment] = useState(r.adminComment || '');
  const [busy, setBusy] = useState(false);
  const [commentSaved, setCommentSaved] = useState(false);
  const g = guestOf(r);
  const p = r.payload || {};
  const lines = orderLines(r);
  const total = requestTotal(r);
  const discount = Number(p.discount) || 0;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const nextStep: [ServiceRequestStatus, string] | null =
    r.status === 'new' ? ['in_progress', 'Взять в работу'] : r.status === 'in_progress' ? ['done', 'Отметить выполненной'] : null;

  return (
    <Drawer
      title={TYPE_LABELS[r.type]}
      subtitle={`Создан ${new Date(r.createdAt).toLocaleString('ru-RU')}`}
      onClose={onClose}
      footer={
        <>
          {isPaidType(r) && !r.paid && (
            <button className="btn success" disabled={busy} onClick={() => run(() => onPaid(true))}>
              <Banknote /> Оплачено
            </button>
          )}
          {nextStep && (
            <button className="btn" disabled={busy} onClick={() => run(() => onStatus(nextStep[0]))}>
              {nextStep[1]}
            </button>
          )}
          {!nextStep && !(isPaidType(r) && !r.paid) && (
            <button className="btn secondary" onClick={onClose}>
              Закрыть
            </button>
          )}
        </>
      }
    >
      <div className="section">
        <div className="section__title">Гость</div>
        <div className="card" style={{ padding: 14 }}>
          {g ? (
            <dl className="kv" style={{ margin: 0 }}>
              <dt>Имя</dt>
              <dd>{g.name}</dd>
              <dt>Комната</dt>
              <dd>№{g.roomNumber}</dd>
              {g.phone && (
                <>
                  <dt>Телефон</dt>
                  <dd>
                    <a href={`tel:${g.phone}`} style={{ color: 'var(--color-primary-dark)' }}>
                      {g.phone}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          ) : (
            <span className="muted">Гость удалён</span>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section__title">Статус</div>
        <div className="seg seg--grid">
          {STATUS_OPTIONS.map(([code, label]) => (
            <button key={code} className={r.status === code ? 'active' : ''} disabled={busy} onClick={() => run(() => onStatus(code))}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {isPaidType(r) && (
        <>
          <div className="section">
            <div className="section__title">Детали заказа</div>
            <div className="receipt">
              {lines.map((it, i) => (
                <div key={i} className="receipt__row">
                  <div>
                    <div className="receipt__name">{it.name}</div>
                    <div className="receipt__qty">
                      {it.qty} × {formatMoney(it.price)}
                    </div>
                  </div>
                  <div className="receipt__sum">{formatMoney(it.price * it.qty)}</div>
                </div>
              ))}
              {lines.length === 0 && <div className="receipt__line">Позиции не указаны</div>}
              {discount > 0 && (
                <div className="receipt__line">
                  <span>Скидка за отзыв</span>
                  <span>−{formatMoney(discount)}</span>
                </div>
              )}
              {r.type === 'hookah' && (p.time || p.note) && (
                <div className="receipt__line" style={{ display: 'block' }}>
                  {p.time && <div>Подать к: <strong style={{ color: 'var(--color-text)' }}>{p.time}</strong></div>}
                  {p.note && <div className="wrap-anywhere">{p.note}</div>}
                </div>
              )}
              <div className="receipt__total">
                <span>Итого</span>
                <span className="money">{formatMoney(total)}</span>
              </div>
            </div>
          </div>

          <div className="section">
            <div className="section__title">Оплата</div>
            <div className={`pay-toggle ${r.paid ? 'paid' : 'unpaid'}`}>
              <div className="pay-toggle__text">
                <div className="pay-toggle__state">{r.paid ? 'Оплачено' : 'Не оплачено'}</div>
                <div className="pay-toggle__sub">
                  Способ: {PAYMENT_METHOD[p.paymentMethod as string] || 'не указан'}
                  {r.paid && r.paidAt ? ` · ${new Date(r.paidAt).toLocaleString('ru-RU')}` : ''}
                </div>
              </div>
              <button className={`btn small ${r.paid ? 'secondary' : 'success'}`} disabled={busy} onClick={() => run(() => onPaid(!r.paid))}>
                {r.paid ? 'Снять отметку' : 'Отметить оплаченным'}
              </button>
            </div>
          </div>
        </>
      )}

      {!isPaidType(r) && (
        <div className="section">
          <div className="section__title">Детали</div>
          <div className="card" style={{ padding: 14 }}>
            <dl className="kv" style={{ margin: 0 }}>
              {(r.type === 'wake_up' || r.type === 'cleaning') && (
                <>
                  <dt>Время</dt>
                  <dd>{p.time || (r.type === 'cleaning' ? 'в любое время' : '—')}</dd>
                </>
              )}
              {r.type === 'extension' && (
                <>
                  <dt>Продлить до</dt>
                  <dd>{p.until || '—'}</dd>
                </>
              )}
              {r.type === 'problem' && (
                <>
                  <dt>Категория</dt>
                  <dd>{PROBLEM_CATEGORY[p.category as string] || p.category || '—'}</dd>
                  <dt>Описание</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{p.description || '—'}</dd>
                </>
              )}
              {p.note && (
                <>
                  <dt>Комментарий гостя</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{p.note}</dd>
                </>
              )}
            </dl>
            {r.type === 'problem' && p.photo && (
              <a href={String(p.photo).startsWith('http') ? p.photo : `${API_URL}${p.photo}`} target="_blank" rel="noreferrer">
                <img
                  src={String(p.photo).startsWith('http') ? p.photo : `${API_URL}${p.photo}`}
                  alt=""
                  style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 10, marginTop: 12 }}
                />
              </a>
            )}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section__title">Комментарий гостю</div>
        <textarea
          rows={3}
          placeholder="Например: «принесём через 15 минут»"
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setCommentSaved(false);
          }}
        />
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button
            className="btn small secondary"
            disabled={busy || comment === (r.adminComment || '')}
            onClick={() =>
              run(async () => {
                await onComment(comment);
                setCommentSaved(true);
              })
            }
          >
            Сохранить комментарий
          </button>
          {commentSaved && <span className="success-text">Сохранено — гость увидит его в «Мои заявки»</span>}
        </div>
      </div>
    </Drawer>
  );
}
