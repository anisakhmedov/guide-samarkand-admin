import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { GuestsPage } from './pages/GuestsPage';
import { PlacesPage } from './pages/PlacesPage';
import { RouteBuilderPage } from './pages/RouteBuilderPage';
import { ChatPage } from './pages/ChatPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { StaffPage } from './pages/StaffPage';
import { MenuPage } from './pages/MenuPage';
import { ServiceRequestsPage } from './pages/ServiceRequestsPage';
import { SettingsPage } from './pages/SettingsPage';

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
