import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { api } from '../api';
import { compact, parseDate, prettyUrl, timeAgo } from '../format';
import { CreateLink } from '../components/CreateLink';
import { CopyButton } from '../components/CopyButton';
import type { Link, Overview } from '../types';

export function LinksPage() {
  const [links, setLinks] = useState<Link[] | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [q, setQ] = useState('');
  const [fresh, setFresh] = useState<number | null>(null);

  useEffect(() => {
    api.overview().then(setOverview).catch(() => {});
  }, [links?.length]);

  useEffect(() => {
    const t = setTimeout(() => api.listLinks(q).then(setLinks).catch(() => setLinks([])), 200);
    return () => clearTimeout(t);
  }, [q]);

  const remove = async (link: Link) => {
    if (!confirm(`Excluir /${link.code}? Quem tiver o link vai ver "não encontrado".`)) return;
    await api.deleteLink(link.id);
    setLinks((ls) => ls?.filter((l) => l.id !== link.id) ?? null);
  };

  return (
    <>
      <section className="hero">
        <h1>Links curtos.<br /><span>Métricas de verdade.</span></h1>
        <CreateLink
          onCreated={(link) => {
            setLinks((ls) => [link, ...(ls ?? [])]);
            setFresh(link.id);
          }}
        />
      </section>

      {overview && (
        <section className="kpis">
          <div><b>{compact(overview.links)}</b><span>links</span></div>
          <div><b>{compact(overview.clicks)}</b><span>cliques no total</span></div>
          <div><b>{compact(overview.clicks_today)}</b><span>cliques hoje</span></div>
        </section>
      )}

      <section className="panel">
        <header className="panel__head">
          <h2>Seus links</h2>
          <input type="search" className="search" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        </header>

        {links === null && <div className="splash">Carregando…</div>}
        {links?.length === 0 && <p className="empty">{q ? 'Nada encontrado.' : 'Nenhum link ainda. Cole uma URL acima para começar.'}</p>}

        <ul className="links">
          {links?.map((link) => {
            const expired = link.expires_at && parseDate(link.expires_at).getTime() < Date.now();
            return (
              <li key={link.id} className={`link-row ${fresh === link.id ? 'is-fresh' : ''}`}>
                <div className="link-row__main">
                  <div className="link-row__short">
                    <a href={link.short_url} target="_blank" rel="noreferrer">{prettyUrl(link.short_url)}</a>
                    {expired && <span className="pill pill--muted">expirado</span>}
                    {!expired && link.expires_at && <span className="pill">expira {timeAgo(link.expires_at)}</span>}
                  </div>
                  <p className="link-row__dest" title={link.url}>
                    {link.title && <strong>{link.title} · </strong>}
                    {prettyUrl(link.url)}
                  </p>
                </div>
                <RouterLink to={`/links/${link.id}`} className="link-row__clicks" title="Ver estatísticas">
                  <b>{compact(link.clicks ?? 0)}</b>
                  <span>{link.last_click ? `último ${timeAgo(link.last_click)}` : 'cliques'}</span>
                </RouterLink>
                <div className="link-row__actions">
                  <CopyButton text={link.short_url} />
                  <RouterLink to={`/links/${link.id}`} className="btn btn--ghost btn--sm">Métricas</RouterLink>
                  <button type="button" className="icon-btn" aria-label={`Excluir /${link.code}`} onClick={() => remove(link)}>×</button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
