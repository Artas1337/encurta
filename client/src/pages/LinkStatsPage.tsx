import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { DEVICE_LABEL, prettyUrl, timeAgo } from '../format';
import { TrendChart } from '../components/TrendChart';
import { BarList } from '../components/BarList';
import { CopyButton } from '../components/CopyButton';
import type { Click, Count, Stats } from '../types';

const RANGES = [7, 30, 90];

/** Soma 1 ao item `name` de uma lista ordenada (ou cria), reordenando. */
const bump = (list: Count[], name: string) => {
  const exists = list.some((c) => c.name === name);
  const next = exists ? list.map((c) => (c.name === name ? { ...c, count: c.count + 1 } : c)) : [...list, { name, count: 1 }];
  return next.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

export function LinkStatsPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [live, setLive] = useState<'connecting' | 'on' | 'off'>('connecting');
  const [flash, setFlash] = useState(0);
  const [showQr, setShowQr] = useState(false);
  const [, tick] = useState(0);
  const freshKey = useRef(0);

  useEffect(() => {
    api.stats(id, days).then(setStats).catch((e) => e.status === 404 && navigate('/', { replace: true }));
  }, [id, days, navigate]);

  // Atualiza os "há X minutos" a cada 30s.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Tempo real: cada clique chega por Server-Sent Events e entra no painel sem recarregar.
  useEffect(() => {
    const es = new EventSource(api.liveUrl(id));
    es.onopen = () => setLive('on');
    es.onerror = () => setLive(es.readyState === EventSource.CLOSED ? 'off' : 'connecting');
    es.addEventListener('click', (ev) => {
      const click = JSON.parse((ev as MessageEvent).data) as Click;
      freshKey.current += 1;
      setFlash(freshKey.current);
      setStats((s) => {
        if (!s) return s;
        const series = s.series.slice();
        const last = series.length - 1;
        if (series[last]?.date === click.at.slice(0, 10)) series[last] = { ...series[last], clicks: series[last].clicks + 1 };
        return {
          ...s,
          clicks: s.clicks + 1,
          series,
          recent: [click, ...s.recent].slice(0, 15),
          referrers: bump(s.referrers, click.referrer),
          browsers: bump(s.browsers, click.browser),
          os: bump(s.os, click.os),
          devices: bump(s.devices, click.device),
        };
      });
    });
    return () => es.close();
  }, [id]);

  if (!stats) return <div className="splash">Carregando métricas…</div>;
  const { link } = stats;

  return (
    <>
      <RouterLink to="/" className="back">← Todos os links</RouterLink>

      <section className="stats-head">
        <div>
          <h1>
            <a href={link.short_url} target="_blank" rel="noreferrer">{prettyUrl(link.short_url)}</a>
          </h1>
          <p className="muted" title={link.url}>{link.title ? `${link.title} · ` : ''}→ {prettyUrl(link.url)}</p>
        </div>
        <div className="stats-head__actions">
          <CopyButton text={link.short_url} />
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowQr(true)}>QR code</button>
        </div>
      </section>

      <section className="kpis">
        <div className={flash ? 'kpi-flash' : ''} key={`c${flash}`}>
          <b>{stats.clicks.toLocaleString('pt-BR')}</b><span>cliques em {days} dias</span>
        </div>
        <div><b>{stats.unique_visitors.toLocaleString('pt-BR')}</b><span>visitantes únicos</span></div>
        <div>
          <b>{stats.clicks && stats.unique_visitors ? (stats.clicks / stats.unique_visitors).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}</b>
          <span>cliques por visitante</span>
        </div>
        <div className={`live live--${live}`}>
          <b><i />{live === 'on' ? 'Ao vivo' : live === 'connecting' ? 'Conectando' : 'Offline'}</b>
          <span>{live === 'on' ? 'novos cliques aparecem na hora' : 'tentando reconectar…'}</span>
        </div>
      </section>

      <section className="panel">
        <header className="panel__head">
          <h2>Cliques por dia</h2>
          <div className="segmented" role="radiogroup" aria-label="Período">
            {RANGES.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={days === r} className={days === r ? 'is-active' : ''} onClick={() => setDays(r)}>
                {r} dias
              </button>
            ))}
          </div>
        </header>
        <TrendChart data={stats.series} />
      </section>

      <div className="grid-3">
        <section className="panel">
          <header className="panel__head"><h2>Origem</h2></header>
          <BarList items={stats.referrers} total={stats.clicks} label={(n) => (n === 'direto' ? 'Direto / app' : n)} />
        </section>
        <section className="panel">
          <header className="panel__head"><h2>Navegador</h2></header>
          <BarList items={stats.browsers} total={stats.clicks} />
        </section>
        <section className="panel">
          <header className="panel__head"><h2>Dispositivo</h2></header>
          <BarList items={stats.devices} total={stats.clicks} label={(n) => DEVICE_LABEL[n] ?? n} />
          <h3 className="sub-h">Sistema</h3>
          <BarList items={stats.os} total={stats.clicks} />
        </section>
      </div>

      <section className="panel">
        <header className="panel__head">
          <h2>Últimos cliques</h2>
          <span className="muted">atualiza sozinho</span>
        </header>
        {stats.recent.length === 0 ? (
          <p className="empty">Ninguém clicou ainda. Compartilhe o link e veja os cliques chegando aqui. ✨</p>
        ) : (
          <ul className="feed">
            {stats.recent.map((c, i) => (
              <li key={`${c.at}-${i}`} className={i === 0 && flash ? 'is-new' : ''}>
                <span className="feed__dot" />
                <span>
                  <b>{DEVICE_LABEL[c.device] ?? c.device}</b> · {c.browser} no {c.os}
                  <span className="muted"> · via {c.referrer === 'direto' ? 'acesso direto' : c.referrer}</span>
                </span>
                <time className="muted">{timeAgo(c.at)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showQr && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowQr(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="QR code">
            <img src={api.qrUrl(link.id)} alt={`QR code para ${link.short_url}`} width={240} height={240} />
            <p><b>{prettyUrl(link.short_url)}</b></p>
            <div className="modal__foot">
              <a className="btn btn--ghost" href={api.qrUrl(link.id)} download={`qr-${link.code}.svg`}>Baixar SVG</a>
              <button type="button" className="btn btn--primary" onClick={() => setShowQr(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
