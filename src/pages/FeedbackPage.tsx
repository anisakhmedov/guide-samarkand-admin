import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Feedback } from '../api/types';

export function FeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([]);

  useEffect(() => {
    api.get<Feedback[]>('/admin/feedback').then(setItems);
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Обратная связь</h1>
          <p className="muted">Отзывы гостей о самом приложении — без модерации, просто лента.</p>
        </div>
      </div>
      {items.map((f) => (
        <div key={f._id} className="card feedback-item">
          <div className="feedback-item__text">{f.text}</div>
          <div className="muted" style={{ marginTop: 8 }}>
            {new Date(f.createdAt).toLocaleString('ru-RU')}
            {typeof f.guestId === 'object' && f.guestId ? ` · ${f.guestId.name}, №${f.guestId.roomNumber}` : ''}
          </div>
        </div>
      ))}
      {items.length === 0 && <div className="card empty-state">Пока нет отзывов</div>}
    </div>
  );
}
