import { Fragment, useEffect, useState } from 'react';
import { api } from '../api/client';
import { Guest } from '../api/types';
import { ActionButtons, StatusCell } from '../components/StatusControls';

export function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState('');
  const [residence, setResidence] = useState('');
  const [review, setReview] = useState('');
  const [access, setAccess] = useState('');
  const [discount, setDiscount] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (residence) params.set('residence', residence);
    if (review) params.set('review', review);
    if (access) params.set('access', access);
    if (discount) params.set('discount', discount);
    setLoading(true);
    api
      .get<Guest[]>(`/admin/guests?${params.toString()}`)
      .then(setGuests)
      .finally(() => setLoading(false));
  };

  useEffect(load, [search, residence, review, access, discount]);

  const setStatus = async (id: string, kind: 'residence' | 'review' | 'access' | 'discount', status: string) => {
    await api.patch(`/admin/guests/${id}/${kind}`, { status });
    load();
  };

  return (
    <div>
      <h1>Гости</h1>
      <div className="toolbar">
        <input className="input" placeholder="Поиск по имени/комнате" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={residence} onChange={(e) => setResidence(e.target.value)}>
          <option value="">Проживание: все</option>
          <option value="pending">ожидает</option>
          <option value="approved">подтверждено</option>
          <option value="rejected">отклонено</option>
        </select>
        <select value={review} onChange={(e) => setReview(e.target.value)}>
          <option value="">Отзыв: все</option>
          <option value="not_sent">не отправлял</option>
          <option value="pending">ожидает проверки</option>
          <option value="approved">подтверждён</option>
        </select>
        <select value={access} onChange={(e) => setAccess(e.target.value)}>
          <option value="">Доступ: все</option>
          <option value="open">открыт</option>
          <option value="closed">закрыт</option>
        </select>
        <select value={discount} onChange={(e) => setDiscount(e.target.value)}>
          <option value="">Скидка: все</option>
          <option value="none">нет</option>
          <option value="pending">ожидает проверки</option>
          <option value="approved">подтверждена</option>
        </select>
      </div>

      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Гость</th>
              <th>Комната</th>
              <th>Проживание</th>
              <th>Отзыв</th>
              <th>Доступ</th>
              <th>Скидка</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => (
              <Fragment key={g._id}>
                <tr onClick={() => setExpanded(expanded === g._id ? null : g._id)} style={{ cursor: 'pointer' }}>
                  <td>{g.name}</td>
                  <td>{g.roomNumber}</td>
                  <td>
                    <StatusCell value={g.statusResidence} />
                    <ActionButtons
                      options={[
                        ['approved', 'Подтвердить'],
                        ['rejected', 'Отклонить'],
                        ['pending', 'Сброс'],
                      ]}
                      current={g.statusResidence}
                      onSelect={(v) => setStatus(g._id, 'residence', v)}
                    />
                  </td>
                  <td>
                    <StatusCell value={g.statusReview} />
                    <ActionButtons
                      options={[
                        ['approved', 'Подтвердить'],
                        ['not_sent', 'Сброс'],
                      ]}
                      current={g.statusReview}
                      onSelect={(v) => setStatus(g._id, 'review', v)}
                    />
                  </td>
                  <td>
                    <StatusCell value={g.accessStatus} />
                    <ActionButtons
                      options={[
                        ['open', 'Открыть'],
                        ['closed', 'Закрыть'],
                      ]}
                      current={g.accessStatus}
                      onSelect={(v) => setStatus(g._id, 'access', v)}
                    />
                  </td>
                  <td>
                    <StatusCell value={g.discountStatus} />
                    <ActionButtons
                      options={[
                        ['approved', 'Подтвердить'],
                        ['none', 'Сброс'],
                      ]}
                      current={g.discountStatus}
                      onSelect={(v) => setStatus(g._id, 'discount', v)}
                    />
                  </td>
                  <td>{expanded === g._id ? '▲' : '▼'}</td>
                </tr>
                {expanded === g._id && (
                  <tr>
                    <td colSpan={7} style={{ background: '#fafbfc' }}>
                      <strong>История действий</strong>
                      <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                        {g.history.slice().reverse().map((h, i) => (
                          <li key={i} className="muted">
                            {new Date(h.at).toLocaleString()} — {h.action} {h.byAdminName ? `(${h.byAdminName})` : ''}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
