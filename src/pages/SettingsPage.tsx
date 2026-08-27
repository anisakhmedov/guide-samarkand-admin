import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { HotelSettings } from '../api/types';

export function SettingsPage() {
  const [discountPercent, setDiscountPercent] = useState(10);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<HotelSettings>('/admin/settings').then((s) => setDiscountPercent(s.discountPercent));
  }, []);

  const save = async () => {
    setError('');
    setSaved(false);
    try {
      await api.patch('/admin/settings', { discountPercent });
      setSaved(true);
    } catch (e: any) {
      setError(e.message || 'Ошибка сохранения');
    }
  };

  return (
    <div>
      <h1>Настройки</h1>
      <div className="card" style={{ padding: 20, maxWidth: 420 }}>
        <div className="field">
          <label>Скидка за отзыв в приложении, % (Опции → «Оставить отзыв»)</label>
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            value={discountPercent}
            onChange={(e) => {
              setDiscountPercent(Number(e.target.value));
              setSaved(false);
            }}
          />
        </div>
        <p className="muted">Применяется к ценам меню room-service для гостей, у которых скидка подтверждена в «Гостях».</p>
        {error && <div className="error-text">{error}</div>}
        {saved && <p style={{ color: 'var(--color-primary)' }}>Сохранено</p>}
        <button className="btn" onClick={save}>
          Сохранить
        </button>
      </div>
    </div>
  );
}
