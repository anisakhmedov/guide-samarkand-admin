import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ListChecks, MessageCircle, PenLine, UserPlus, X, type LucideIcon } from 'lucide-react';
import { api, sameJson } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { AdminNotifications } from '../api/types';
import { initNotifications, notificationPermission, notify, NotifyPermission, requestNotificationPermission } from '../notify';

const POLL_MS = 10000;
const HIDDEN_POLL_MS = 30000;
const TOAST_MS = 8000;
const SOUND_KEY = 'admin_notify_sound';
const BASE_TITLE = document.title;

export type NotificationKind = 'guests' | 'reviews' | 'chat' | 'requests';

export const KIND_META: Record<NotificationKind, { Icon: LucideIcon; tone: string; url: string; label: string }> = {
  requests: { Icon: ListChecks, tone: 'blue', url: '/requests', label: 'Новые запросы гостей' },
  chat: { Icon: MessageCircle, tone: 'green', url: '/chat', label: 'Новые сообщения в чате' },
  guests: { Icon: UserPlus, tone: 'orange', url: '/guests?residence=pending', label: 'Гости ждут подтверждения' },
  reviews: { Icon: PenLine, tone: 'purple', url: '/guests?review=pending', label: 'Отзывы на проверку (скидка)' },
};

interface Toast {
  id: number;
  kind: NotificationKind;
  title: string;
  body: string;
}

interface ContextValue {
  data: AdminNotifications;
  counts: Record<NotificationKind, number>;
  total: number;
  permission: NotifyPermission;
  enable: () => Promise<void>;
  sound: boolean;
  setSound: (on: boolean) => void;
}

const EMPTY: AdminNotifications = { unreadChat: 0, newRequests: 0, pendingGuests: 0, pendingReviews: 0, pendingDiscounts: 0, lastGuestActivityAt: null };
const Ctx = createContext<ContextValue | undefined>(undefined);

const countsOf = (d: AdminNotifications): Record<NotificationKind, number> => ({
  requests: d.newRequests,
  chat: d.unreadChat,
  guests: d.pendingGuests,
  // pendingDiscounts is kept by older API builds — same guests as pendingReviews.
  reviews: Math.max(d.pendingReviews, d.pendingDiscounts),
});

const readSound = () => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
};

// Single poller for the whole admin panel: feeds the bell (sidebar on desktop, top bar on
// phones), shows in-app toasts, a system notification when the tab is in the background,
// and the "(3)" counter in the browser tab title. Polling instead of the chat Socket.io
// gateway on purpose — the production API doesn't keep persistent connections.
export function AdminNotificationsProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminNotifications>(EMPTY);
  const [permission, setPermission] = useState<NotifyPermission>(notificationPermission);
  const [sound, setSoundState] = useState(readSound);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const prevRef = useRef<AdminNotifications | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const pushToast = (kind: NotificationKind, title: string, body: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.filter((x) => x.kind !== kind), { id, kind, title, body }].slice(-4));
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), TOAST_MS);
    notify({ title, body, url: KIND_META[kind].url, tag: `admin-${kind}`, sound: soundRef.current });
  };

  const load = () =>
    api
      .get<AdminNotifications>('/admin/notifications')
      .then((raw) => {
        const s = { ...EMPTY, ...raw };
        setData((prev) => (sameJson(prev, s) ? prev : s));
        const prev = prevRef.current;
        prevRef.current = s;
        if (!prev) return;
        if (s.newRequests > prev.newRequests) {
          const n = s.newRequests - prev.newRequests;
          pushToast('requests', n > 1 ? `Новые запросы: ${n}` : 'Новый запрос гостя', 'Откройте «Запросы гостей», чтобы принять в работу');
        }
        if (s.unreadChat > prev.unreadChat) {
          pushToast('chat', 'Новое сообщение в чате', 'Гость написал в чат');
        }
        if (s.pendingGuests > prev.pendingGuests) {
          pushToast('guests', 'Новый гость', 'Ждёт подтверждения проживания');
        } else if (s.pendingGuests > 0 && s.lastGuestActivityAt && s.lastGuestActivityAt !== prev.lastGuestActivityAt && s.pendingReviews <= prev.pendingReviews) {
          // Same guest re-submitted the form (same name + room) — count unchanged, still worth a ping.
          pushToast('guests', 'Заявка гостя', 'Гость повторно отправил данные — проверьте «Гости»');
        }
        if (s.pendingReviews > prev.pendingReviews) {
          pushToast('reviews', 'Отзыв на проверку', 'Гость оставил отзыв — после подтверждения у него включится скидка');
        }
      })
      .catch(() => {});

  useEffect(() => initNotifications((url) => navigate(url)), []);

  // Keeps polling (slower) in a background tab so system notifications still arrive.
  usePolling(load, POLL_MS, [], { hiddenIntervalMs: HIDDEN_POLL_MS });

  const counts = countsOf(data);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  useEffect(() => {
    document.title = total > 0 ? `(${total}) ${BASE_TITLE}` : BASE_TITLE;
  }, [total]);
  useEffect(() => () => void (document.title = BASE_TITLE), []);

  const setSound = (on: boolean) => {
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
    } catch {
      // ignore
    }
    setSoundState(on);
  };

  const enable = async () => setPermission(await requestNotificationPermission());

  return (
    <Ctx.Provider value={{ data, counts, total, permission, enable, sound, setSound }}>
      {children}
      {createPortal(
        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => {
            const meta = KIND_META[toast.kind];
            return (
              <div
                key={toast.id}
                className="toast"
                role="button"
                onClick={() => {
                  setToasts((prev) => prev.filter((x) => x.id !== toast.id));
                  navigate(meta.url);
                }}
              >
                <span className={`toast__icon tone-${meta.tone}`}>
                  <meta.Icon size={18} />
                </span>
                <span className="toast__text">
                  <span className="toast__title">{toast.title}</span>
                  <span className="toast__body">{toast.body}</span>
                </span>
                <button
                  type="button"
                  className="toast__close"
                  aria-label="Закрыть"
                  onClick={(e) => {
                    e.stopPropagation();
                    setToasts((prev) => prev.filter((x) => x.id !== toast.id));
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

export function useAdminNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminNotifications must be used within AdminNotificationsProvider');
  return ctx;
}
