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
      <div className="page-head">
        <h1>Персонал</h1>
      </div>

      <div className="split">
        <div className="table-wrap responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Роль</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s._id}>
                  <td className="primary">
                    <div className="cell-title wrap-anywhere">{s.name}</div>
                    <div className="cell-sub">логин: {s.login}</div>
                  </td>
                  <td data-label="Роль">{ROLE_LABEL[s.role]}</td>
                  <td className="aside">
                    <span className={`badge ${s.active ? 'green' : 'red'}`}>{s.active ? 'активен' : 'заблокирован'}</span>
                  </td>
                  <td className="actions">
                    <div className="btn-row">
                      <button className={`btn small ${s.active ? 'danger-outline' : 'secondary'}`} onClick={() => toggleActive(s)}>
                        {s.active ? 'Заблокировать' : 'Разблокировать'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {staff.length === 0 && <div className="table-empty">Сотрудников пока нет</div>}
        </div>

        <div className="card">
          <h2>Новый сотрудник</h2>
          <form onSubmit={create}>
            <div className="field">
              <label>Имя</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Логин</label>
              <input className="input" value={login} onChange={(e) => setLogin(e.target.value)} required autoCapitalize="none" autoCorrect="off" />
            </div>
            <div className="field">
              <label>Пароль</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
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
            <button className="btn block" type="submit">
              Создать
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
