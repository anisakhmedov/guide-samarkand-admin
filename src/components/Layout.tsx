import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Compass, ListChecks, WifiOff, LogOut, MapPinned, Menu, MessageCircle, Settings, ScrollText, Sparkles, UtensilsCrossed, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiEvents } from '../api/client';
import { useIsCompact } from '../hooks/useMediaQuery';
import { NotificationBell } from './NotificationBell';
import { AdminNotificationsProvider } from './AdminNotifications';

const NAV = [
  { to: '/guests', label: 'Гости', Icon: Users, roles: ['super_admin', 'reception'] },
  { to: '/requests', label: 'Запросы гостей', Icon: ListChecks, roles: ['super_admin', 'reception'] },
  { to: '/chat', label: 'Чат', Icon: MessageCircle, roles: ['super_admin', 'reception'] },
  { to: '/menu', label: 'Меню room-service', Icon: UtensilsCrossed, roles: ['super_admin', 'reception'] },
  { to: '/places', label: 'Контент гайда', Icon: MapPinned, roles: ['super_admin', 'content_manager'] },
  { to: '/routes', label: 'Конструктор маршрутов', Icon: Compass, roles: ['super_admin', 'reception'] },
  { to: '/feedback', label: 'Обратная связь', Icon: ScrollText, roles: ['super_admin', 'reception', 'content_manager'] },
  { to: '/staff', label: 'Персонал', Icon: Sparkles, roles: ['super_admin'] },
  { to: '/settings', label: 'Настройки', Icon: Settings, roles: ['super_admin'] },
];

export function Layout() {
  const { admin, logout } = useAuth();
  const { pathname } = useLocation();
  const compact = useIsCompact();
  const [menuOpen, setMenuOpen] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    apiEvents.addEventListener('online', on);
    apiEvents.addEventListener('offline', off);
    return () => {
      apiEvents.removeEventListener('online', on);
      apiEvents.removeEventListener('offline', off);
    };
  }, []);

  // Close the off-canvas menu after navigating or when the screen grows back to desktop.
  useEffect(() => setMenuOpen(false), [pathname, compact]);

  if (!admin) return null;

  const nav = NAV.filter((item) => item.roles.includes(admin.role));
  const current = nav.find((item) => pathname.startsWith(item.to));
  const initials = admin.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <AdminNotificationsProvider>
      <div className="layout">
        <div className={`sidebar-overlay ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />
        <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
          <div className="sidebar__brand">
            <div className="sidebar__brand-name">
              <div className="sidebar__brand-icon">
                <Compass size={18} />
              </div>
              Гид — Админ
            </div>
            {/* Bell lives in the sidebar on desktop and in the top bar on phones (data comes from the shared provider). */}
            {!compact && <NotificationBell />}
            <button className="sidebar__close" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню">
              <X size={18} />
            </button>
          </div>
          <div className="sidebar__section-label">Управление</div>
          <nav>
            {nav.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
                <Icon />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar__staff">
            <div className="sidebar__staff-avatar">{initials}</div>
            <div className="sidebar__staff-info">
              <div className="sidebar__staff-name">{admin.name}</div>
              <div className="sidebar__staff-role">{roleLabel(admin.role)}</div>
            </div>
            <button className="sidebar__logout" onClick={logout} title="Выйти" aria-label="Выйти">
              <LogOut size={15} />
            </button>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button className="topbar__menu" onClick={() => setMenuOpen(true)} aria-label="Открыть меню">
              <Menu size={20} />
            </button>
            <div className="topbar__title">{current?.label ?? 'Гид — Админ'}</div>
            {compact && <NotificationBell align="right" />}
          </header>
          {offline && (
            <div className="offline-banner" role="status">
              <WifiOff size={16} /> Нет связи с сервером — данные обновятся автоматически, как только связь вернётся
            </div>
          )}
          <main className="content">
            {/* Inner boundary: switching sections keeps the sidebar/top bar on screen. */}
            <Suspense fallback={<p className="muted page-loading">Загрузка…</p>}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </AdminNotificationsProvider>
  );
}

function roleLabel(role: string) {
  return { super_admin: 'Супер-админ', reception: 'Ресепшен', content_manager: 'Контент-менеджер' }[role] || role;
}
