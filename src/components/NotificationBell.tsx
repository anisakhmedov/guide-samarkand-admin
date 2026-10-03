import { CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Bell, BellOff, BellRing, CheckCircle2, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import { KIND_META, NotificationKind, useAdminNotifications } from './AdminNotifications';

const ORDER: NotificationKind[] = ['requests', 'chat', 'guests', 'reviews'];
const PANEL_WIDTH = 330;

// Bell + dropdown. The panel is portalled to <body> with fixed positioning, so neither the
// scrollable sidebar nor the sticky top bar can clip it.
export function NotificationBell({ align = 'left' }: { align?: 'left' | 'right' }) {
  const { counts, total, permission, enable, sound, setSound } = useAdminNotifications();
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    const left = align === 'right' ? r.right - width : r.left;
    setStyle({ top: r.bottom + 8, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)), width });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  const rows = ORDER.filter((k) => counts[k] > 0);

  return (
    <div className="notif-bell">
      <button
        ref={triggerRef}
        className={`notif-bell__trigger ${total > 0 ? 'has-unread' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Уведомления"
        aria-label={`Уведомления${total ? `: ${total}` : ''}`}
      >
        <Bell size={17} />
        {total > 0 && <span className="notif-bell__badge">{total > 99 ? '99+' : total}</span>}
      </button>

      {open &&
        createPortal(
          <div ref={panelRef} className="notif-panel" style={style} role="dialog" aria-label="Уведомления">
            <div className="notif-panel__head">
              <span>Уведомления</span>
              {total > 0 && <span className="badge accent">{total}</span>}
            </div>

            <div className="notif-panel__list">
              {rows.length === 0 && (
                <div className="notif-panel__empty">
                  <CheckCircle2 size={28} />
                  <div>Всё обработано</div>
                  <span className="muted">Новые заявки, сообщения и гости появятся здесь</span>
                </div>
              )}
              {rows.map((kind) => {
                const meta = KIND_META[kind];
                return (
                  <Link key={kind} to={meta.url} className="notif-panel__row" onClick={() => setOpen(false)}>
                    <span className={`notif-panel__icon tone-${meta.tone}`}>
                      <meta.Icon size={17} />
                    </span>
                    <span className="notif-panel__label">{meta.label}</span>
                    <span className="notif-panel__count">{counts[kind]}</span>
                    <ChevronRight size={16} className="notif-panel__chevron" />
                  </Link>
                );
              })}
            </div>

            <div className="notif-panel__foot">
              {permission === 'default' && (
                <button className="btn small block" onClick={enable}>
                  <BellRing /> Включить уведомления в браузере
                </button>
              )}
              {permission === 'granted' && (
                <div className="notif-panel__status ok">
                  <BellRing size={15} /> Уведомления браузера включены
                </div>
              )}
              {permission === 'denied' && (
                <div className="notif-panel__status warn">
                  <BellOff size={15} /> Заблокированы в браузере — разрешите их для этого сайта (значок слева от адреса)
                </div>
              )}
              <button className="notif-panel__sound" onClick={() => setSound(!sound)}>
                {sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
                Звук: {sound ? 'включён' : 'выключен'}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
