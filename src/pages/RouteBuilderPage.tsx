import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { api } from '../api/client';
import { GuideRoute, Place, RouteDuration, RouteTheme, TransportType } from '../api/types';
import { numberedIcon } from '../components/leafletIcons';

interface DraftPoint {
  placeId: string;
  name: string;
  comment: string;
  legDistanceMeters?: number;
  legDurationMinutes?: number;
}

const THEMES: RouteTheme[] = ['history', 'food', 'kids', 'evening', 'photo'];
const DURATIONS: RouteDuration[] = ['short', 'half_day', 'full_day'];

const THEME_LABEL: Record<RouteTheme, string> = {
  history: 'История',
  food: 'Гастрономия',
  kids: 'С детьми',
  evening: 'Вечерний',
  photo: 'Фотомаршрут',
};

const DURATION_LABEL: Record<RouteDuration, string> = {
  short: '1–2 часа',
  half_day: 'Полдня',
  full_day: 'Целый день',
};

export function RouteBuilderPage() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [routes, setRoutes] = useState<GuideRoute[]>([]);
  const [search, setSearch] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState<RouteTheme>('history');
  const [duration, setDuration] = useState<RouteDuration>('short');
  const [transport, setTransport] = useState<TransportType>('walking');
  const [published, setPublished] = useState(true);
  const [points, setPoints] = useState<DraftPoint[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const previewMapDivRef = useRef<HTMLDivElement>(null);
  const previewMapRef = useRef<L.Map | null>(null);
  const previewLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    api.get<Place[]>('/admin/places').then(setPlaces);
    loadRoutes();
  }, []);

  // Route preview map (PLAN.md "Предпросмотр маршрута на карте перед публикацией").
  useEffect(() => {
    if (!previewMapDivRef.current || previewMapRef.current) return;
    const map = L.map(previewMapDivRef.current).setView([39.6547, 66.975], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    previewMapRef.current = map;
    previewLayerRef.current = L.layerGroup().addTo(map);
  }, []);

  useEffect(() => {
    const map = previewMapRef.current;
    const layer = previewLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const placeById = new Map(places.map((p) => [p._id, p]));
    const coords = points
      .map((p) => placeById.get(p.placeId)?.location)
      .filter((loc): loc is { lat: number; lng: number } => !!loc);

    if (coords.length === 0) return;

    coords.forEach((loc, i) => L.marker([loc.lat, loc.lng], { icon: numberedIcon(i + 1) }).addTo(layer));
    if (coords.length > 1) {
      L.polyline(
        coords.map((c) => [c.lat, c.lng]),
        { color: '#2f6659', weight: 4 },
      ).addTo(layer);
    }
    map.fitBounds(L.latLngBounds(coords.map((c) => [c.lat, c.lng])), { padding: [24, 24], maxZoom: 16 });
  }, [points, places]);

  const loadRoutes = () => api.get<GuideRoute[]>('/admin/routes').then(setRoutes);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setTheme('history');
    setDuration('short');
    setTransport('walking');
    setPublished(true);
    setPoints([]);
    setError('');
  };

  const editRoute = (r: GuideRoute) => {
    // `/admin/routes` (list) doesn't populate points.placeId, only `/admin/routes/:id` does —
    // resolve names from the already-loaded places list so editing from the list view still
    // shows real place names instead of raw ids.
    const placeById = new Map(places.map((p) => [p._id, p.name]));
    setEditingId(r._id);
    setTitle(r.title);
    setTheme(r.theme || 'history');
    setDuration(r.durationEstimate);
    setTransport(r.transportType);
    setPublished(r.published);
    setPoints(
      r.points.map((p) => {
        const id = typeof p.placeId === 'string' ? p.placeId : p.placeId._id;
        const name = typeof p.placeId === 'string' ? placeById.get(id) || id : p.placeId.name;
        return {
        placeId: id,
        name,
        comment: p.comment,
        legDistanceMeters: p.legDistanceMeters,
        legDurationMinutes: p.legDurationMinutes,
        };
      }),
    );
    setError('');
  };

  const addPlace = (place: Place) => {
    if (points.some((p) => p.placeId === place._id)) return;
    setPoints([...points, { placeId: place._id, name: place.name, comment: '' }]);
  };

  const removePoint = (idx: number) => setPoints(points.filter((_, i) => i !== idx));

  const updateComment = (idx: number, comment: string) =>
    setPoints(points.map((p, i) => (i === idx ? { ...p, comment } : p)));

  const onDrop = (idx: number) => {
    if (dragIndex === null || dragIndex === idx) return;
    const next = [...points];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(idx, 0, moved);
    setPoints(next);
    setDragIndex(null);
  };

  const save = async () => {
    if (!title || points.length === 0) {
      setError('Укажите название и хотя бы одну точку');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      title,
      theme,
      durationEstimate: duration,
      transportType: transport,
      published,
      points: points.map((p) => ({ placeId: p.placeId, comment: p.comment })),
    };
    try {
      if (editingId) {
        await api.patch(`/admin/routes/${editingId}`, payload);
      } else {
        await api.post('/admin/routes', payload);
      }
      resetForm();
      loadRoutes();
    } catch (e: any) {
      setError(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (r: GuideRoute) => {
    await api.patch(`/admin/routes/${r._id}/published`, { published: !r.published });
    loadRoutes();
  };

  const removeRoute = async (id: string) => {
    if (!confirm('Удалить маршрут?')) return;
    await api.delete(`/admin/routes/${id}`);
    if (editingId === id) resetForm();
    loadRoutes();
  };

  const filteredPlaces = places.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const totalDistance = points.reduce((s, p) => s + (p.legDistanceMeters || 0), 0);
  const totalDuration = points.reduce((s, p) => s + (p.legDurationMinutes || 0), 0);

  return (
    <div>
      <h1>Конструктор маршрутов</h1>

      <div className="route-builder">
        <div className="card">
          <h2>Точки гайда</h2>
          <input className="input" placeholder="Поиск…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', marginBottom: 10 }} />
          <div className="place-pick-list">
            {filteredPlaces.map((p) => (
              <div key={p._id} className="place-pick-item">
                <span>{p.name}</span>
                <button className="btn small secondary" onClick={() => addPlace(p)}>
                  +
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="two-col">
              <div className="field">
                <label>Название маршрута</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="field">
                <label>Тематика</label>
                <select value={theme} onChange={(e) => setTheme(e.target.value as RouteTheme)}>
                  {THEMES.map((th) => (
                    <option key={th} value={th}>
                      {THEME_LABEL[th]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="two-col">
              <div className="field">
                <label>Длительность</label>
                <select value={duration} onChange={(e) => setDuration(e.target.value as RouteDuration)}>
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {DURATION_LABEL[d]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Способ передвижения</label>
                <select value={transport} onChange={(e) => setTransport(e.target.value as TransportType)}>
                  <option value="walking">Пешком</option>
                  <option value="transport">На транспорте</option>
                </select>
              </div>
            </div>
            <label>
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Опубликован
            </label>
          </div>

          <h2>Точки маршрута ({points.length})</h2>
          <p className="muted">Перетащите, чтобы изменить порядок. Расстояние и время между точками считаются автоматически при сохранении.</p>
          <ul className="route-points-list">
            {points.map((p, idx) => (
              <li
                key={p.placeId}
                className={`route-point-row ${dragIndex === idx ? 'dragging' : ''}`}
                draggable
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(idx)}
              >
                <span className="handle">⠿</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    {idx + 1}. {p.name}
                  </div>
                  <input
                    className="input"
                    placeholder="Комментарий (например: здесь можно перекусить)"
                    value={p.comment}
                    onChange={(e) => updateComment(idx, e.target.value)}
                    style={{ width: '100%', marginTop: 6 }}
                  />
                  {idx > 0 && p.legDistanceMeters !== undefined && (
                    <div className="muted" style={{ marginTop: 4 }}>
                      +{Math.round(p.legDistanceMeters)} м · ~{p.legDurationMinutes} мин от предыдущей точки
                    </div>
                  )}
                </div>
                <button className="btn small danger" onClick={() => removePoint(idx)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {points.length > 1 && totalDistance > 0 && (
            <p className="muted">
              Итого: {(totalDistance / 1000).toFixed(1)} км · ~{totalDuration} мин
            </p>
          )}

          <h2>Предпросмотр на карте</h2>
          <div ref={previewMapDivRef} style={{ height: 280, borderRadius: 10, overflow: 'hidden', marginBottom: 12 }} />

          {error && <div className="error-text">{error}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={save} disabled={saving}>
              {editingId ? 'Сохранить изменения' : 'Создать маршрут'}
            </button>
            {editingId && (
              <button className="btn secondary" onClick={resetForm}>
                Новый маршрут
              </button>
            )}
          </div>
        </div>
      </div>

      <h2 style={{ marginTop: 32 }}>Существующие маршруты</h2>
      <table>
        <thead>
          <tr>
            <th>Название</th>
            <th>Точек</th>
            <th>Тематика</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {routes.map((r) => (
            <tr key={r._id}>
              <td>{r.title}</td>
              <td>{r.points.length}</td>
              <td>{r.theme ? THEME_LABEL[r.theme] : '—'}</td>
              <td>
                <span className={`badge ${r.published ? 'green' : 'orange'}`}>{r.published ? 'опубликован' : 'черновик'}</span>
              </td>
              <td style={{ display: 'flex', gap: 6 }}>
                <button className="btn small secondary" onClick={() => editRoute(r)}>
                  Изменить
                </button>
                <button className="btn small secondary" onClick={() => togglePublished(r)}>
                  {r.published ? 'Снять с публикации' : 'Опубликовать'}
                </button>
                <button className="btn small danger" onClick={() => removeRoute(r._id)}>
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
