import { useEffect, useState } from 'react';
import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { api, API_URL } from '../api/client';
import { Place, PlaceCategory } from '../api/types';
import { Drawer } from '../components/Drawer';

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
  const [saving, setSaving] = useState(false);

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
    const { _id, ...rest } = editing;
    const payload = { ...rest, extraFields };
    setSaving(true);
    try {
      if (_id) {
        await api.patch(`/admin/places/${_id}`, payload);
      } else {
        await api.post('/admin/places', payload);
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
    if (!confirm('Удалить место?')) return;
    await api.delete(`/admin/places/${id}`);
    setEditing(null);
    load();
  };

  const uploadPhoto = async (file: File) => {
    if (!editing) return;
    const form = new FormData();
    form.append('file', file);
    const { url } = await api.post<{ url: string }>('/upload/admin', form);
    setEditing((prev) => (prev ? { ...prev, photos: [...(prev.photos || []), url] } : prev));
  };

  const removePhoto = (idx: number) => {
    if (!editing) return;
    setEditing({ ...editing, photos: (editing.photos || []).filter((_, i) => i !== idx) });
  };

  return (
    <div>
      <div className="page-head">
        <h1>Контент гайда</h1>
        <button className="btn" onClick={startNew}>
          <Plus /> Добавить место
        </button>
      </div>
      <div className="tabs">
        {CATEGORIES.map((c) => (
          <button key={c.code} className={category === c.code ? 'active' : ''} onClick={() => setCategory(c.code)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="table-wrap responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Место</th>
              <th>Район</th>
              <th>Рекомендовано</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {places.map((p) => (
              <tr key={p._id} className="clickable" onClick={() => startEdit(p)}>
                <td className="primary">
                  <div className="cell-main">
                    {p.photos?.[0] ? <img className="thumb" src={p.photos[0].startsWith('http') ? p.photos[0] : `${API_URL}${p.photos[0]}`} alt="" /> : null}
                    <div style={{ minWidth: 0 }}>
                      <div className="cell-title wrap-anywhere">{p.name}</div>
                      {p.workingHours && <div className="cell-sub">{p.workingHours}</div>}
                    </div>
                  </div>
                </td>
                <td data-label="Район">{p.district || <span className="muted">—</span>}</td>
                <td className="aside">
                  {p.recommendedByHotel ? (
                    <span className="badge orange">
                      <Star size={12} /> отель рекомендует
                    </span>
                  ) : null}
                </td>
                <td className="actions">
                  <div className="btn-row">
                    <button
                      className="btn small secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(p);
                      }}
                    >
                      <Pencil /> Изменить
                    </button>
                    <button
                      className="btn small danger-outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(p._id);
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
        {places.length === 0 && <div className="table-empty">В этой категории пока нет мест</div>}
      </div>

      {editing && (
        <Drawer
          wide
          title={editing._id ? 'Редактирование места' : 'Новое место'}
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
            <div className="input-group">
              <input
                className="input"
                placeholder="Например: Регистан, Самарканд"
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchAddress())}
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
            <label className="check-label" style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--color-text)', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={!!editing.recommendedByHotel}
                onChange={(e) => setEditing({ ...editing, recommendedByHotel: e.target.checked })}
              />
              Рекомендовано отелем
            </label>
          </div>

          <div className="field">
            <label>Фото</label>
            <div className="photo-row" style={{ marginBottom: 8 }}>
              {(editing.photos || []).map((p, i) => (
                <div key={i} className="photo-thumb">
                  <img src={p.startsWith('http') ? p : `${API_URL}${p}`} alt="" />
                  <button type="button" onClick={() => removePhoto(i)} aria-label="Убрать фото">
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
          </div>

          {error && <div className="error-text">{error}</div>}

          {editing._id && (
            <button className="btn small danger-outline" style={{ marginTop: 8 }} onClick={() => remove(editing._id!)}>
              <Trash2 /> Удалить место
            </button>
          )}
        </Drawer>
      )}
    </div>
  );
}
