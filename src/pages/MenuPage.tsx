import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, API_URL } from '../api/client';
import { MenuItem, MenuItemType } from '../api/types';
import { Drawer } from '../components/Drawer';
import { formatMoney } from '../components/StatusControls';

const TYPES: { code: MenuItemType; label: string }[] = [
  { code: 'food', label: 'Питание в номера' },
  { code: 'drink', label: 'Напитки с бара' },
];

const EMPTY: Partial<MenuItem> = {
  type: 'food',
  name: '',
  description: '',
  price: 0,
  discountedPrice: 0,
  photo: '',
  active: true,
};

const photoUrl = (p: string) => (p.startsWith('http') ? p : `${API_URL}${p}`);

// Room-service menu CRUD (Options -> Food/Drinks pricing). Structurally mirrors PlacesPage.tsx.
export function MenuPage() {
  const [type, setType] = useState<MenuItemType>('food');
  const [items, setItems] = useState<MenuItem[]>([]);
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get<MenuItem[]>(`/admin/menu?type=${type}`).then(setItems);
  };

  useEffect(load, [type]);

  const startNew = () => {
    setEditing({ ...EMPTY, type });
    setError('');
  };

  const startEdit = (item: MenuItem) => {
    setEditing(item);
    setError('');
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) {
      setError('Укажите название');
      return;
    }
    setSaving(true);
    try {
      const { _id, ...body } = editing;
      if (_id) {
        await api.patch(`/admin/menu/${_id}`, body);
      } else {
        await api.post('/admin/menu', body);
      }
      setEditing(null);
      load();
    } catch (e: any) {
      setError(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Удалить позицию меню?')) return;
    await api.delete(`/admin/menu/${id}`);
    setEditing(null);
    load();
  };

  const uploadPhoto = async (file: File) => {
    if (!editing) return;
    const form = new FormData();
    form.append('file', file);
    const { url } = await api.post<{ url: string }>('/upload/admin', form);
    setEditing((prev) => (prev ? { ...prev, photo: url } : prev));
  };

  return (
    <div>
      <div className="page-head">
        <h1>Меню room-service</h1>
        <button className="btn" onClick={startNew}>
          <Plus /> Добавить позицию
        </button>
      </div>

      <div className="tabs">
        {TYPES.map((tp) => (
          <button key={tp.code} className={type === tp.code ? 'active' : ''} onClick={() => setType(tp.code)}>
            {tp.label}
          </button>
        ))}
      </div>

      <div className="table-wrap responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Позиция</th>
              <th className="num">Цена</th>
              <th className="num">Со скидкой</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id} className="clickable" onClick={() => startEdit(item)}>
                <td className="primary">
                  <div className="cell-main">
                    {item.photo ? <img className="thumb" src={photoUrl(item.photo)} alt="" /> : null}
                    <div style={{ minWidth: 0 }}>
                      <div className="cell-title wrap-anywhere">{item.name}</div>
                      {item.description && <div className="cell-sub wrap-anywhere">{item.description}</div>}
                    </div>
                  </div>
                </td>
                <td className="num" data-label="Цена">
                  <span className="money">{formatMoney(item.price)}</span>
                </td>
                <td className="num" data-label="Со скидкой">
                  {item.discountedPrice > 0 ? formatMoney(item.discountedPrice) : <span className="muted">авто</span>}
                </td>
                <td className="aside">
                  <span className={`badge ${item.active ? 'green' : ''}`}>{item.active ? 'видна гостям' : 'скрыта'}</span>
                </td>
                <td className="actions">
                  <div className="btn-row">
                    <button
                      className="btn small secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(item);
                      }}
                    >
                      <Pencil /> Изменить
                    </button>
                    <button
                      className="btn small danger-outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(item._id);
                      }}
                    >
                      <Trash2 /> Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="table-empty">В этом разделе пока нет позиций</div>}
      </div>

      {editing && (
        <Drawer
          title={editing._id ? 'Редактирование позиции' : 'Новая позиция'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={save} disabled={saving}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
              <button className="btn secondary" onClick={() => setEditing(null)}>
                Отмена
              </button>
            </>
          }
        >
          <div className="two-col">
            <div className="field">
              <label>Раздел</label>
              <select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as MenuItemType })}>
                {TYPES.map((tp) => (
                  <option key={tp.code} value={tp.code}>
                    {tp.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Название</label>
              <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
          </div>

          <div className="field">
            <label>Описание</label>
            <textarea rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </div>

          <div className="two-col">
            <div className="field">
              <label>Цена, сум</label>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={0}
                value={editing.price}
                onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Цена со скидкой, сум</label>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={0}
                value={editing.discountedPrice}
                onChange={(e) => setEditing({ ...editing, discountedPrice: Number(e.target.value) })}
              />
              <div className="hint">0 — рассчитывается автоматически из % скидки в настройках.</div>
            </div>
          </div>

          <div className="field">
            <label className="check-label" style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--color-text)', fontSize: '0.88rem' }}>
              <input type="checkbox" checked={!!editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              Активна (видна гостям)
            </label>
          </div>

          <div className="field">
            <label>Фото</label>
            {editing.photo && (
              <div className="photo-row" style={{ marginBottom: 8 }}>
                <div className="photo-thumb">
                  <img src={photoUrl(editing.photo)} alt="" />
                  <button type="button" onClick={() => setEditing({ ...editing, photo: '' })} aria-label="Убрать фото">
                    ✕
                  </button>
                </div>
              </div>
            )}
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
          </div>

          {error && <div className="error-text">{error}</div>}

          {editing._id && (
            <button className="btn small danger-outline" style={{ marginTop: 8 }} onClick={() => remove(editing._id!)}>
              <Trash2 /> Удалить позицию
            </button>
          )}
        </Drawer>
      )}
    </div>
  );
}
