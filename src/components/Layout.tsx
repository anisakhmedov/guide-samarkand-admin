import { NavLink, Outlet } from 'react-router-dom';
import { Compass, ListChecks, LogOut, MapPinned, MessageCircle, Settings, ScrollText, Sparkles, UtensilsCrossed, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/guests', label: 'Гости', Icon: Users, roles: ['super_admin', 'reception'] },
  { to: '/places', label: 'Контент гайда', Icon: MapPinned, roles: ['super_admin', 'content_manager'] },
  { to: '/routes', label: 'Конструктор маршрутов', Icon: Compass, roles: ['super_admin', 'reception'] },
  { to: '/menu', label: 'Меню room-service', Icon: UtensilsCrossed, roles: ['super_admin', 'reception'] },
  { to: '/requests', label: 'Запросы гостей', Icon: ListChecks, roles: ['super_admin', 'reception'] },
  { to: '/chat', label: 'Чат', Icon: MessageCircle, roles: ['super_admin', 'reception'] },
  { to: '/feedback', label: 'Обратная связь', Icon: ScrollText, roles: ['super_admin', 'reception', 'content_manager'] },
  { to: '/staff', label: 'Персонал', Icon: Sparkles, roles: ['super_admin'] },
  { to: '/settings', label: 'Настройки', Icon: Settings, roles: ['super_admin'] },
];

export function Layout() {
  const { admin, logout } = useAuth();
  if (!admin) return null;

  const initials = admin.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__brand-icon">
            <Compass size={18} />
          </div>
          Гид — Админ
        </div>
        <div className="sidebar__section-label">Управление</div>
        {NAV.filter((item) => item.roles.includes(admin.role)).map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon />
            {label}
          </NavLink>
        ))}
        <div className="sidebar__staff">
          <div className="sidebar__staff-avatar">{initials}</div>
          <div>
            <div className="sidebar__staff-name">{admin.name}</div>
            <div className="sidebar__staff-role">{roleLabel(admin.role)}</div>
          </div>
          <div className="sidebar__logout" onClick={logout} title="Выйти">
            <LogOut size={15} />
          </div>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

function roleLabel(role: string) {
  return { super_admin: 'Супер-админ', reception: 'Ресепшен', content_manager: 'Контент-менеджер' }[role] || role;
}
