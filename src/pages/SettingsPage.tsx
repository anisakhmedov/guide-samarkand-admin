import { useEffect, useState } from 'react';
import { Flame, Percent } from 'lucide-react';
import { api } from '../api/client';
import { HotelSettings } from '../api/types';
import { formatMoney } from '../components/StatusControls';

export function SettingsPage() {
  const [settings, setSettings] = useState<HotelSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<HotelSettings>('/admin/settings').then((s) =>
      setSettings({ ...s, hookahPrice: s.hookahPrice ?? 0, hookahAvailable: s.hookahAvailable ?? true }),
    );
  }, []);

  if (!settings) return <p className="muted">Загрузка…</p>;

  const update = (patch: Partial<HotelSettings>) => {
    setSettings({ ...settings, ...patch });
    setSaved(false);
  };

  const save = async () => {
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const { discountPercent, markupPercent, hookahPrice, hookahAvailable } = settings;
      await api.patch('/admin/settings', {
        discountPercent: Math.round(discountPercent),
        markupPercent: Math.round(markupPercent),
        hookahPrice: Math.round(hookahPrice),
        hookahAvailable,
      });
      setSaved(true);
    } catch (e: any) {
      setError(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Настройки</h1>
      </div>

      <div className="settings-grid">
        <div className="card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Percent size={18} color="var(--color-primary)" /> Цены меню
          </h2>
          <div className="field">
            <label>Скидка за отзыв в приложении, %</label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={settings.discountPercent}
              onChange={(e) => update({ discountPercent: Number(e.target.value) })}
            />
            <div className="hint">Опции → «Оставить отзыв». Применяется к меню room-service для гостей, у которых скидка подтверждена в «Гостях».</div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Надбавка (НДС, доставка), %</label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={settings.markupPercent}
              onChange={(e) => update({ markupPercent: Number(e.target.value) })}
            />
            <div className="hint">Автоматически добавляется к базовым ценам и ценам со скидкой при показе гостям.</div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Flame size={18} color="var(--color-accent)" /> Кальян
          </h2>
          <div className="field">
            <label>Цена за кальян, сум</label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              value={settings.hookahPrice}
              onChange={(e) => update({ hookahPrice: Number(e.target.value) })}
            />
            <div className="hint">
              Итоговая цена для гостя (без надбавки и скидки). Сейчас гость увидит: <strong>{formatMoney(settings.hookahPrice)}</strong>
            </div>
          </div>
          <label className="check-label">
            <input type="checkbox" checked={settings.hookahAvailable} onChange={(e) => update({ hookahAvailable: e.target.checked })} />
            Принимать заказы на кальян
          </label>
          {settings.hookahAvailable && settings.hookahPrice <= 0 && (
            <div className="hint" style={{ color: 'var(--color-warn)', marginTop: 8 }}>
              Укажите цену — пока она 0, гости не смогут заказать кальян.
            </div>
          )}
        </div>
      </div>

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить настройки'}
        </button>
        {saved && <span className="success-text">Сохранено</span>}
        {error && <span className="error-text">{error}</span>}
      </div>
    </div>
  );
}
