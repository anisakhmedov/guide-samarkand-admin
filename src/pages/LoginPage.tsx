import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(loginValue, password);
      navigate('/guests');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-card__brand">
          <div className="login-card__brand-icon">
            <Compass size={20} />
          </div>
          Гид — Админ
        </div>
        <div className="field">
          <label>Логин</label>
          <input className="input" value={loginValue} onChange={(e) => setLoginValue(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label>Пароль</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} disabled={submitting} type="submit">
          Войти
        </button>
        <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
          Демо: admin / admin123 (см. backend/.env)
        </p>
      </form>
    </div>
  );
}
