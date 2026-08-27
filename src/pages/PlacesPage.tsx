import { useEffect, useState } from 'react';
import { api, API_URL } from '../api/client';
import { Place, PlaceCategory } from '../api/types';

interface GeocodeResult {
  displayName: string;
  lat: number;
  lng: number;
}

const CATEGORIES: { code: PlaceCategory; label: string }[] = [
  { code: 'restaurant', label: 'Рестораны' },
  { code: 'cafe', label: 'Кафе' },
  { code: 'attraction', label: 'Достопримечательности' },
  { code: 'service', label: 'Сервисы' },
];

const EMPTY: Partial<Place> = {
  category: 'restaurant',
  name: '',
  description: '',
  photos: [],
  location: { lat: 39.6547, lng: 66.975 },
  district: '',
  workingHours: '',
  extraFields: {},
  recommendedByHotel: false,
};

export function PlacesPage() {
  const [category, setCategory] = useState<PlaceCategory>('restaurant');
  const [places, setPlaces] = useState<Place[]>([]);
  const [editing, setEditing] = useState<Partial<Place> | null>(null);
  const [extraFieldsText, setExtraFieldsText] = useState('{}');
  const [error, setError] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<GeocodeResult[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);

  const load = () => {
    api.get<Place[]>(`/admin/places?category=${category}`).then(setPlaces);
  };

  useEffect(load, [category]);

  const startNew = () => {
    setEditing({ ...EMPTY, category });
    setExtraFieldsText('{}');
    setError('');
    setAddressQuery('');
    setAddressResults([]);
  };

  const startEdit = (p: Place) => {
    setEditing(p);
    setExtraFieldsText(JSON.stringify(p.extraFields || {}, null, 2));
    setError('');
    setAddressQuery('');
    setAddressResults([]);
  };

  // Address -> coordinates via the backend's Nominatim proxy (PLAN.md "Геокодирование").
  const searchAddress = async () => {
    if (!addressQuery.trim()) return;
    setSearchingAddress(true);
    try {
      const results = await api.get<GeocodeResult[]>(`/admin/geocode?q=${encodeURIComponent(addressQuery.trim())}`);
      setAddressResults(results);
    } finally {
      setSearchingAddress(false);
    }
  };

  const pickAddressResult = (r: GeocodeResult) => {
    if (!editing) return;
    setEditing({ ...editing, location: { lat: r.lat, lng: r.lng } });
    setAddressResults([]);
    setAddressQuery(r.displayName);
  };

  const save = async () => {
    if (!editing) return;
    let extraFields = {};
    try {
      extraFields = JSON.parse(extraFieldsText || '{}');
    } catch {
      setError('Доп. поля должны быть валидным JSON');
      return;
    }
    const payload = { ...editing, extraFields };
    try {
      if (editing._id) {
        await api.patch(`/admin/places/${editing._id}`, payload);
      } else {
        await api.post('/admin/places', payload);
      }
      setEditing(null);
      load();
    } catch (e: any) {
      setError(e.message || 'Ошибка сохранения');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Удалить место?')) return;
    await api.delete(`/admin/places/${id}`);
    load();
  };

  const uploadPhoto = async (file: File) => {
    if (!editing) return;
    const form = new FormData();
    form.append('file', file);
    const { url } = await api.post<{ url: string }>('/upload/admin', form);
    setEditing({ ...editing, photos: [...(editing.photos || []), url] });
  };

  return (
    <div>
      <h1>Контент гайда</h1>
      <div className="tabs">
        {CATEGORIES.map((c) => (
          <button key={c.code} className={category === c.code ? 'active' : ''} onClick={() => setCategory(c.code)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <button className="btn" onClick={startNew}>
          + Добавить место
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Название</th>
            <th>Район</th>
            <th>Рекомендовано</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {places.map((p) => (
            <tr key={p._id}>
              <td>{p.name}</td>
              <td>{p.district}</td>
              <td>{p.recommendedByHotel ? '⭐' : ''}</td>
              <td>
                <button className="btn small secondary" onClick={() => startEdit(p)}>
                  Изменить
                </button>{' '}
                <button className="btn small danger" onClick={() => remove(p._id)}>
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <div className="card" style={{ marginTop: 20, maxWidth: 640 }}>
          <h2>{editing._id ? 'Редактирование места' : 'Новое место'}</h2>
          <div className="two-col">
            <div className="field">
              <label>Категория</label>
              <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as PlaceCategory })}>
                {CATEGORIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
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
            <textarea rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </div>

          <div className="two-col">
            <div className="field">
              <label>Район</label>
              <input className="input" value={editing.district} onChange={(e) => setEditing({ ...editing, district: e.target.value })} />
            </div>
            <div className="field">
              <label>Часы работы</label>
              <input className="input" value={editing.workingHours} onChange={(e) => setEditing({ ...editing, workingHours: e.target.value })} />
            </div>
          </div>

          <div className="field">
            <label>Поиск по адресу (Nominatim/OpenStreetMap)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                placeholder="Например: Регистан, Самарканд"
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchAddress())}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn secondary" onClick={searchAddress} disabled={searchingAddress}>
                Найти
              </button>
            </div>
            {addressResults.length > 0 && (
              <div className="card" style={{ marginTop: 6, padding: 6 }}>
                {addressResults.map((r, i) => (
                  <div
                    key={i}
                    className="place-pick-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => pickAddressResult(r)}
                  >
                    <span style={{ fontSize: '0.82rem' }}>{r.displayName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="two-col">
            <div className="field">
              <label>Широта (lat)</label>
              <input
                className="input"
                type="number"
                step="0.0001"
                value={editing.location?.lat}
                onChange={(e) => setEditing({ ...editing, location: { ...editing.location!, lat: Number(e.target.value) } })}
              />
            </div>
            <div className="field">
              <label>Долгота (lng)</label>
              <input
                className="input"
                type="number"
                step="0.0001"
                value={editing.location?.lng}
                onChange={(e) => setEditing({ ...editing, location: { ...editing.location!, lng: Number(e.target.value) } })}
              />
            </div>
          </div>

          <div className="field">
            <label>Доп. поля (JSON — например {'{"cuisine":"узбекская","priceRange":"$$"}'})</label>
            <textarea rows={3} value={extraFieldsText} onChange={(e) => setExtraFieldsText(e.target.value)} />
          </div>

          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={!!editing.recommendedByHotel}
                onChange={(e) => setEditing({ ...editing, recommendedByHotel: e.target.checked })}
              />{' '}
              Рекомендовано отелем
            </label>
          </div>

          <div className="field">
            <label>Фото</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {(editing.photos || []).map((p, i) => (
                <img key={i} src={p.startsWith('http') ? p : `${API_URL}${p}`} style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 6 }} />
              ))}
            </div>
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
