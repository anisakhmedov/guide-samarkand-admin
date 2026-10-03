import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { lazy } from 'react';

const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const GuestsPage = page(() => import('./pages/GuestsPage'), 'GuestsPage');
const PlacesPage = page(() => import('./pages/PlacesPage'), 'PlacesPage');
const RouteBuilderPage = page(() => import('./pages/RouteBuilderPage'), 'RouteBuilderPage');
const ChatPage = page(() => import('./pages/ChatPage'), 'ChatPage');
const FeedbackPage = page(() => import('./pages/FeedbackPage'), 'FeedbackPage');
const StaffPage = page(() => import('./pages/StaffPage'), 'StaffPage');
const MenuPage = page(() => import('./pages/MenuPage'), 'MenuPage');
const ServiceRequestsPage = page(() => import('./pages/ServiceRequestsPage'), 'ServiceRequestsPage');
const SettingsPage = page(() => import('./pages/SettingsPage'), 'SettingsPage');

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { admin } = useAuth();
  if (!admin) return <Navigate to="/login" replace />;
  return children;
}

function Router() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/guests" replace />} />
        <Route path="guests" element={<GuestsPage />} />
        <Route path="places" element={<PlacesPage />} />
        <Route path="routes" element={<RouteBuilderPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="requests" element={<ServiceRequestsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
