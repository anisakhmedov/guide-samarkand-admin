import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, FileSignature } from 'lucide-react';
import { api, sameJson } from '../api/client';
import { useDebounced, usePolling } from '../hooks/usePolling';
import { Guest, GuestContact } from '../api/types';
import { Drawer } from '../components/Drawer';
import { ActionButtons, SearchBox, StatusCell } from '../components/StatusControls';

// The review and the menu discount are one thing now: confirming the review turns the
// discount on (the backend keeps statusReview and discountStatus in sync).
type StatusKind = 'residence' | 'review' | 'access';

const LABELS: Record<StatusKind, Record<string, string>> = {
  residence: { pending: 'ожидает', approved: 'подтверждено', rejected: 'отклонено' },
  review: { not_sent: 'не оставлял', pending: 'на проверке', approved: 'подтверждён · скидка' },
  access: { open: 'открыт', closed: 'закрыт' },
};

// Old history entries from before the merge.
const LEGACY_DISCOUNT_LABELS: Record<string, string> = { none: 'нет', pending: 'на проверке', approved: 'подтверждена' };

const KIND_TITLE: Record<StatusKind, string> = {
  residence: 'Проживание',
  review: 'Отзыв и скидка',
  access: 'Доступ к гиду',
};

const ACTIONS: Record<StatusKind, [string, string][]> = {
  residence: [
    ['approved', 'Подтвердить'],
    ['rejected', 'Отклонить'],
    ['pending', 'Сбросить'],
  ],
  review: [
    ['approved', 'Подтвердить'],
    ['not_sent', 'Сбросить'],
  ],
  access: [
    ['open', 'Открыть'],
    ['closed', 'Закрыть'],
  ],
};

/** Combined review state (legacy guests may have only one of review/discount set). */
function reviewValue(g: Guest) {
  if (g.statusReview === 'pending' || g.discountStatus === 'pending') return 'pending';
  if (g.statusReview === 'approved' || g.discountStatus === 'approved') return 'approved';
  return 'not_sent';
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['ru'], { type: 'region' });
  } catch {
    return null;
  }
})();
const flagOf = (code: string) => String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
const countryLabel = (code?: string) => (code ? `${flagOf(code)} ${regionNames?.of(code) ?? code}` : '—');

function formatBirthDate(iso?: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y} · ${age} ${ruYears(age)}`;
}

function ruYears(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'год';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'года';
  return 'лет';
}

const statusValue = (g: Guest, kind: StatusKind) =>
  ({ residence: g.statusResidence, review: reviewValue(g), access: g.accessStatus })[kind];

// The single most likely next step for reception, surfaced right in the list row. Confirming
// the stay also opens the guide (the review is optional now — the app asks for it later).
function nextAction(g: Guest): { kind: StatusKind; status: string; label: string } | null {
  if (g.statusResidence === 'pending') return { kind: 'residence', status: 'approved', label: 'Подтвердить проживание' };
  if (reviewValue(g) === 'pending') return { kind: 'review', status: 'approved', label: 'Подтвердить отзыв' };
  return null;
}

function Status({ g, kind }: { g: Guest; kind: StatusKind }) {
  const value = statusValue(g, kind);
  return <StatusCell value={value} label={LABELS[kind][value] ?? value} />;
}

export function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  const [residence, setResidence] = useState(searchParams.get('residence') ?? '');
  const [review, setReview] = useState(searchParams.get('review') ?? '');
  const [access, setAccess] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<Guest | null>(null);
  const debouncedSearch = useDebounced(search.trim(), 300);
  const requestSeq = useRef(0);

  // Links from the notification bell (/guests?residence=pending etc.) re-apply their filter.
  useEffect(() => {
    setResidence(searchParams.get('residence') ?? '');
    setReview(searchParams.get('review') ?? '');
  }, [searchParams]);

  const load = (silent = false) => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (residence) params.set('residence', residence);
    if (review) params.set('review', review);
    if (access) params.set('access', access);
    if (!silent) setLoading(true);
    // Typing/filtering fires several requests; only the latest one may update the list.
    const seq = ++requestSeq.current;
    return api
      .get<Guest[]>(`/admin/guests?${params.toString()}`)
      .then((list) => {
        if (seq === requestSeq.current) setGuests((prev) => (sameJson(prev, list) ? prev : list));
      })
      .finally(() => seq === requestSeq.current && setLoading(false));
  };

  // New guest applications appear without a manual page reload.
  const firstLoad = useRef(true);
  usePolling(
    () => {
      const silent = !firstLoad.current;
      firstLoad.current = false;
      return load(silent);
    },
    15000,
    [debouncedSearch, residence, review, access],
  );

  // The list omits action history (keeps polling light) — fetch it when a card is opened.
  useEffect(() => {
    setDetails(null);
    if (!openId) return;
    let cancelled = false;
    api.get<Guest>(`/admin/guests/${openId}`).then((g) => !cancelled && setDetails(g)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [openId]);

  const setStatus = async (id: string, kind: StatusKind, status: string) => {
    const updated = await api.patch<Guest>(`/admin/guests/${id}/${kind}`, { status });
    setGuests((prev) => prev.map((g) => (g._id === id ? { ...g, ...updated } : g)));
    if (id === openId) setDetails(updated);
  };

  const listed = guests.find((g) => g._id === openId) || null;
  const opened = listed && details?._id === listed._id ? { ...listed, history: details.history } : listed;
  const hasFilters = !!(search || residence || review || access);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Гости</h1>
          <p className="muted">Нажмите на гостя, чтобы открыть контакты, все статусы и историю действий.</p>
        </div>
      </div>

      <div className="toolbar">
        <SearchBox value={search} onChange={setSearch} placeholder="Поиск: имя, комната, телефон, username" />
        <select value={residence} onChange={(e) => setResidence(e.target.value)}>
          <option value="">Проживание: все</option>
          <option value="pending">ожидает</option>
          <option value="approved">подтверждено</option>
          <option value="rejected">отклонено</option>
        </select>
        <select value={review} onChange={(e) => setReview(e.target.value)}>
          <option value="">Отзыв: все</option>
          <option value="not_sent">не оставлял</option>
          <option value="pending">на проверке</option>
          <option value="approved">подтверждён</option>
        </select>
        <select value={access} onChange={(e) => setAccess(e.target.value)}>
          <option value="">Доступ: все</option>
          <option value="open">открыт</option>
          <option value="closed">закрыт</option>
        </select>
        {hasFilters && (
          <button
            className="btn ghost small"
            onClick={() => {
              setSearch('');
              setResidence('');
              setReview('');
              setAccess('');
            }}
          >
            Сбросить фильтры
          </button>
        )}
      </div>

      {loading && guests.length === 0 ? (
        <p className="muted">Загрузка…</p>
      ) : (
        <div className="table-wrap responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Гость</th>
                <th>Доступ</th>
                <th>Проживание</th>
                <th>Отзыв</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => {
                const next = nextAction(g);
                return (
                  <tr key={g._id} className={`clickable ${next ? 'is-new' : ''}`} onClick={() => setOpenId(g._id)}>
                    <td className="primary">
                      <div className="cell-title wrap-anywhere">{g.name}</div>
                      <div className="cell-sub">
                        {g.country ? `${flagOf(g.country)} ` : ''}Комната №{g.roomNumber}
                        {g.phone ? ` · ${g.phone}` : ''}
                        {!g.rulesAcceptedAt && <span className="badge orange" style={{ marginLeft: 6 }}>правила не подписаны</span>}
                      </div>
                    </td>
                    <td className="aside">
                      <Status g={g} kind="access" />
                    </td>
                    <td data-label="Проживание">
                      <Status g={g} kind="residence" />
                    </td>
                    <td data-label="Отзыв">
                      <Status g={g} kind="review" />
                    </td>
                    <td className="actions">
                      <div className="btn-row">
                        {next && (
                          <button
                            className="btn small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatus(g._id, next.kind, next.status);
                            }}
                          >
                            {next.label}
                          </button>
                        )}
                        <button className="btn small secondary" onClick={() => setOpenId(g._id)}>
                          Открыть <ChevronRight size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {guests.length === 0 && <div className="table-empty">Гостей не найдено</div>}
        </div>
      )}

      {opened && (
        <Drawer
          title={opened.name}
          subtitle={`Комната №${opened.roomNumber} · зарегистрирован ${new Date(opened.createdAt).toLocaleString('ru-RU')}`}
          onClose={() => setOpenId(null)}
        >
          <div className="section">
            <div className="section__title">Контакты</div>
            <div className="card" style={{ padding: 14 }}>
              <GuestContacts phone={opened.phone} contacts={opened.contacts} />
            </div>
          </div>

          <div className="section">
            <div className="section__title">Анкета и правила проживания</div>
            <div className="card" style={{ padding: 14 }}>
              <dl className="kv" style={{ margin: 0 }}>
                <dt>Страна</dt>
                <dd>{countryLabel(opened.country)}</dd>
                <dt>Дата рождения</dt>
                <dd>{formatBirthDate(opened.birthDate)}</dd>
                <dt>Правила</dt>
                <dd>
                  {opened.rulesAcceptedAt ? (
                    <span className="badge green">
                      <FileSignature size={12} /> подписаны {new Date(opened.rulesAcceptedAt).toLocaleString('ru-RU')}
                    </span>
                  ) : (
                    <span className="badge orange">ещё не подписаны</span>
                  )}
                </dd>
              </dl>
              {opened.rulesAcceptedAt && (
                <div className="signature-view">
                  {details?._id === opened._id ? (
                    details.rulesSignature ? (
                      <img src={details.rulesSignature} alt="Подпись гостя" />
                    ) : (
                      <span className="muted">Подпись не найдена</span>
                    )
                  ) : (
                    <span className="muted">Загрузка подписи…</span>
                  )}
                  <span className="signature-view__caption">Подпись гостя</span>
                </div>
              )}
            </div>
          </div>

          <div className="section">
            <div className="section__title">Статусы</div>
            <p className="muted" style={{ margin: '0 0 8px' }}>
              Подтверждение проживания сразу открывает гостю доступ к гиду. Отзыв необязателен — приложение попросит его при следующем визите.
            </p>
            {(['residence', 'review', 'access'] as StatusKind[]).map((kind) => (
              <div key={kind} className="status-block">
                <div className="status-block__label">
                  {KIND_TITLE[kind]} <Status g={opened} kind={kind} />
                </div>
                <ActionButtons options={ACTIONS[kind]} current={statusValue(opened, kind)} onSelect={(v) => setStatus(opened._id, kind, v)} />
              </div>
            ))}
          </div>

          <div className="section">
            <div className="section__title">История действий</div>
            <div className="card" style={{ padding: '4px 14px' }}>
              {!opened.history ? (
                <p className="muted">Загрузка…</p>
              ) : opened.history.length === 0 ? (
                <p className="muted">Пока пусто</p>
              ) : (
                <ul className="history-list">
                  {opened.history
                    .slice()
                    .reverse()
                    .map((h, i) => (
                      <li key={i}>
                        <time>{new Date(h.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time>
                        <span className="wrap-anywhere">
                          {historyLabel(h.action)}
                          {h.byAdminName ? <span className="muted"> · {h.byAdminName}</span> : ''}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}

function historyLabel(action: string) {
  const [kind, value] = action.split(':');
  if (value === 'submitted_by_guest') return kind === 'review' ? 'Гость отметил, что оставил отзыв' : 'Гость запросил скидку за отзыв';
  if (kind === 'discount') return `Скидка: ${LEGACY_DISCOUNT_LABELS[value] ?? value}`;
  const title = KIND_TITLE[kind as StatusKind];
  const label = LABELS[kind as StatusKind]?.[value];
  return title && label ? `${title}: ${label}` : action;
}

const CHANNEL_LABELS: Record<GuestContact['type'], string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  wechat: 'WeChat',
  viber: 'Viber',
  other: 'Другое',
};

const digitsOnly = (s: string) => s.replace(/\D/g, '');

// Builds a "write to guest" link where the messenger supports one; WeChat/other are shown as text.
function contactLink(c: GuestContact, phone?: string): string | null {
  const v = c.value.trim();
  switch (c.type) {
    case 'telegram':
      return v ? `https://t.me/${v.replace(/^@/, '')}` : null;
    case 'instagram':
      return v ? `https://instagram.com/${v.replace(/^@/, '')}` : null;
    case 'whatsapp': {
      const num = digitsOnly(v || phone || '');
      return num ? `https://wa.me/${num}` : null;
    }
    case 'viber': {
      const num = digitsOnly(v || phone || '');
      return num ? `viber://chat?number=%2B${num}` : null;
    }
    default:
      return null;
  }
}

function GuestContacts({ phone, contacts }: { phone?: string; contacts?: GuestContact[] }) {
  if (!phone && !contacts?.length) return <span className="muted">Контакты не указаны</span>;
  return (
    <div className="contact-list">
      {phone && <a href={`tel:${phone}`}>{phone}</a>}
      {contacts?.map((c) => {
        const href = contactLink(c, phone);
        const text = `${CHANNEL_LABELS[c.type]}${c.value ? `: ${c.type === 'telegram' || c.type === 'instagram' ? '@' : ''}${c.value}` : ''}`;
        return href ? (
          <a key={c.type} href={href} target="_blank" rel="noreferrer">
            {text}
          </a>
        ) : (
          <span key={c.type}>{text}</span>
        );
      })}
    </div>
  );
}
