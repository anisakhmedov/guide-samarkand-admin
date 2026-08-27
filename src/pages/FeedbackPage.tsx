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
      <h1>Обратная связь</h1>
      <p className="muted">Отзывы гостей о самом приложении — без модерации, просто лента.</p>
      {items.map((f) => (
        <div key={f._id} className="card" style={{ marginBottom: 10 }}>
          <div>{f.text}</div>
          <div className="muted" style={{ marginTop: 6 }}>
            {new Date(f.createdAt).toLocaleString()} {typeof f.guestId === 'object' && f.guestId ? `· ${f.guestId.name} №${f.guestId.roomNumber}` : ''}
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="muted">Пока нет отзывов</p>}
    </div>
  );
}
