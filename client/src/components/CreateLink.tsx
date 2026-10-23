import { useState, type FormEvent } from 'react';
import { api } from '../api';
import type { Link } from '../types';

/** Formulário principal: cola a URL e pronto. Apelido, título e validade ficam em "opções". */
export function CreateLink({ onCreated }: { onCreated: (link: Link) => void }) {
  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [title, setTitle] = useState('');
  const [expires, setExpires] = useState('');
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const withProtocol = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      const link = await api.createLink({
        url: withProtocol,
        alias: alias.trim() || undefined,
        title: title.trim() || undefined,
        expiresAt: expires ? new Date(expires).toISOString() : undefined,
      });
      onCreated(link);
      setUrl('');
      setAlias('');
      setTitle('');
      setExpires('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="create" onSubmit={submit}>
      <div className="create__main">
        <input
          className="create__url"
          placeholder="Cole um link longo aqui…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="URL de destino"
          required
        />
        <button className="btn btn--primary" disabled={busy}>{busy ? 'Encurtando…' : 'Encurtar'}</button>
      </div>

      <button type="button" className="link create__toggle" onClick={() => setMore((m) => !m)} aria-expanded={more}>
        {more ? '− Menos opções' : '+ Apelido, título e validade'}
      </button>

      {more && (
        <div className="create__more">
          <label className="field">
            Apelido (opcional)
            <span className="prefix-input">
              <span>/</span>
              <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="meu-link" maxLength={30} />
            </span>
          </label>
          <label className="field">
            Título (opcional)
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Slides da apresentação" maxLength={100} />
          </label>
          <label className="field">
            Expira em (opcional)
            <input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </label>
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
