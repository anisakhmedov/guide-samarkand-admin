import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ListChecks, MessageCircle } from 'lucide-react';
import { api } from '../api/client';
import { AdminNotifications } from '../api/types';

const POLL_MS = 15000;

// Sidebar bell, visible on every admin page: unread guest chat messages + service
// requests nobody has actioned yet. Polling (not the chat Socket.io gateway) on purpose —
// the backend runs as Vercel serverless functions in production, which don't hold
// persistent WS connections (see ChatPage.tsx's frontend for the same reasoning).
export function NotificationBell() {
  const [data, setData] = useState<AdminNotifications>({ unreadChat: 0, newRequests: 0 });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => api.get<AdminNotifications>('/admin/notifications').then(setData).catch(() => {});

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const total = data.unreadChat + data.newRequests;

  return (
    <div className="notif-bell" ref={ref}>
      <button className="notif-bell__trigger" onClick={() => setOpen((v) => !v)} title="Уведомления">
        <Bell size={16} />
        {total > 0 && <span className="notif-bell__badge">{total > 9 ? '9+' : total}</span>}
      </button>
      {open && (
        <div className="notif-bell__panel card">
          {data.unreadChat > 0 && (
            <Link to="/chat" className="notif-bell__row" onClick={() => setOpen(false)}>
              <MessageCircle size={16} />
              <span>Новые сообщения в чате</span>
              <span className="badge orange">{data.unreadChat}</span>
            </Link>
          )}
          {data.newRequests > 0 && (
            <Link to="/requests" className="notif-bell__row" onClick={() => setOpen(false)}>
              <ListChecks size={16} />
              <span>Новые запросы гостей</span>
              <span className="badge orange">{data.newRequests}</span>
            </Link>
          )}
          {total === 0 && <div className="muted notif-bell__empty">Новых уведомлений нет</div>}
        </div>
      )}
    </div>
  );
}
