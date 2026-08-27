import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';
import { AdminRole, StaffMember } from '../api/types';

const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: 'Супер-админ',
  reception: 'Ресепшен',
  content_manager: 'Контент-менеджер',
};

export function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('reception');
  const [error, setError] = useState('');

  const load = () => api.get<StaffMember[]>('/admin/staff').then(setStaff);
  useEffect(() => {
    load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/staff', { name, login, password, role });
      setName('');
      setLogin('');
      setPassword('');
      load();
    } catch (err: any) {
      setError(err.message || 'Ошибка');
    }
  };

  const toggleActive = async (s: StaffMember) => {
    await api.patch(`/admin/staff/${s._id}/active`, { active: !s.active });
    load();
  };

  return (
    <div>
      <h1>Персонал</h1>

      <table>
        <thead>
          <tr>
            <th>Имя</th>
            <th>Логин</th>
            <th>Роль</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s._id}>
              <td>{s.name}</td>
              <td>{s.login}</td>
              <td>{ROLE_LABEL[s.role]}</td>
              <td>
                <span className={`badge ${s.active ? 'green' : 'red'}`}>{s.active ? 'активен' : 'заблокирован'}</span>
              </td>
              <td>
                <button className="btn small secondary" onClick={() => toggleActive(s)}>
                  {s.active ? 'Заблокировать' : 'Разблокировать'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="card" style={{ marginTop: 20, maxWidth: 420 }}>
        <h2>Новый сотрудник</h2>
        <form onSubmit={create}>
          <div className="field">
            <label>Имя</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Логин</label>
            <input className="input" value={login} onChange={(e) => setLogin(e.target.value)} required />
          </div>
          <div className="field">
            <label>Пароль</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="field">
            <label>Роль</label>
            <select value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
              <option value="reception">Ресепшен</option>
              <option value="content_manager">Контент-менеджер</option>
              <option value="super_admin">Супер-админ</option>
            </select>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn" type="submit">
            Создать
          </button>
        </form>
      </div>
    </div>
  );
}
