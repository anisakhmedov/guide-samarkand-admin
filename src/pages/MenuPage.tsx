import { useEffect, useState } from 'react';
import { api, API_URL } from '../api/client';
import { MenuItem, MenuItemType } from '../api/types';

const TYPES: { code: MenuItemType; label: string }[] = [
  { code: 'food', label: 'Питание в номера' },
  { code: 'drink', label: 'Напитки с бара' },
];

const EMPTY: Partial<MenuItem> = {
  type: 'food',
  name: '',
  description: '',
  price: 0,
  photo: '',
  active: true,
};

// Room-service menu CRUD (Options -> Food/Drinks pricing). Structurally mirrors PlacesPage.tsx.
export function MenuPage() {
  const [type, setType] = useState<MenuItemType>('food');
  const [items, setItems] = useState<MenuItem[]>([]);
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [error, setError] = useState('');

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
    try {
      if (editing._id) {
        await api.patch(`/admin/menu/${editing._id}`, editing);
      } else {
        await api.post('/admin/menu', editing);
      }
      setEditing(null);
      load();
    } catch (e: any) {
      setError(e.message || 'Ошибка сохранения');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Удалить позицию меню?')) return;
    await api.delete(`/admin/menu/${id}`);
    load();
  };

  const uploadPhoto = async (file: File) => {
    if (!editing) return;
    const form = new FormData();
    form.append('file', file);
    const { url } = await api.post<{ url: string }>('/upload/admin', form);
    setEditing({ ...editing, photo: url });
  };

  return (
    <div>
      <h1>Меню room-service</h1>
      <div className="tabs">
        {TYPES.map((tp) => (
          <button key={tp.code} className={type === tp.code ? 'active' : ''} onClick={() => setType(tp.code)}>
            {tp.label}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <button className="btn" onClick={startNew}>
          + Добавить позицию
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Название</th>
            <th>Цена</th>
            <th>Активна</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item._id}>
              <td>{item.name}</td>
              <td>{item.price.toLocaleString()} сум</td>
              <td>{item.active ? '✅' : ''}</td>
              <td>
                <button className="btn small secondary" onClick={() => startEdit(item)}>
                  Изменить
                </button>{' '}
                <button className="btn small danger" onClick={() => remove(item._id)}>
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <div className="card" style={{ marginTop: 20, maxWidth: 640 }}>
          <h2>{editing._id ? 'Редактирование позиции' : 'Новая позиция'}</h2>
          <div className="two-col">
            <div className="field">
              <label>Тип</label>
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

          <div className="field">
            <label>Цена (сум)</label>
            <input
              className="input"
              type="number"
              min={0}
              value={editing.price}
              onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
            />
          </div>

          <div className="field">
            <label>
              <input type="checkbox" checked={!!editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />{' '}
              Активна (видна гостям)
            </label>
          </div>

          <div className="field">
            <label>Фото</label>
            {editing.photo && (
              <img
                src={editing.photo.startsWith('http') ? editing.photo : `${API_URL}${editing.photo}`}
                style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 6, display: 'block', marginBottom: 8 }}
              />
            )}
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
          </div>

          {error && <div className="error-text">{error}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={save}>
              Сохранить
            </button>
            <button className="btn secondary" onClick={() => setEditing(null)}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
