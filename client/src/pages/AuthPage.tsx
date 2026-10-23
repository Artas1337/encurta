import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { Logo } from '../components/Shell';
import { isCommonEmail, PASSWORD_RULES } from '../validation';

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const isLogin = mode === 'login';

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email'));
    if (!isLogin) {
      if (!isCommonEmail(email)) {
        return setError('Use um e-mail de um provedor comum (Gmail, Outlook, Hotmail, iCloud, Yahoo…)');
      }
      if (!PASSWORD_RULES.every((r) => r.test(password))) return setError('A senha ainda não atende todos os requisitos');
    }
    setError('');
    setBusy(true);
    try {
      if (isLogin) await login(email, password);
      else await register(String(form.get('name')), email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <form className="auth__card" onSubmit={handleSubmit}>
        <Logo />
        <div>
          <h1>{isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}</h1>
          <p className="muted">Encurte links e descubra quem clica: origem, dispositivo e horário, em tempo real.</p>
        </div>

        {!isLogin && (
          <label className="field">
            Nome
            <input name="name" required minLength={2} autoComplete="name" />
          </label>
        )}
        <label className="field">
          E-mail
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label className="field">
          Senha
          <input
            name="password"
            type="password"
            required
            minLength={isLogin ? 1 : 10}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={isLogin ? undefined : 'password-rules'}
          />
        </label>
        {!isLogin && (
          <ul id="password-rules" className="pw-rules">
            {PASSWORD_RULES.map((r) => {
              const ok = r.test(password);
              return (
                <li key={r.label} className={ok ? 'is-ok' : ''}>
                  <span aria-hidden="true">{ok ? '✓' : '•'}</span> {r.label}
                </li>
              );
            })}
          </ul>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Aguarde…' : isLogin ? 'Entrar' : 'Criar conta'}
        </button>

        <p className="auth__switch muted">
          {isLogin ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
          <button
            type="button"
            className="link"
            onClick={() => {
              setMode(isLogin ? 'register' : 'login');
              setError('');
            }}
          >
            {isLogin ? 'Cadastre-se' : 'Entrar'}
          </button>
        </p>
      </form>
    </main>
  );
}
