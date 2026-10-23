import type { Count } from '../types';

/** Lista ranqueada com barra proporcional atrás do rótulo (uma só cor; a identidade é o texto). */
export function BarList({ items, total, label = (n) => n }: { items: Count[]; total: number; label?: (name: string) => string }) {
  if (items.length === 0) return <p className="empty">Sem dados no período.</p>;
  const max = items[0].count;
  return (
    <ul className="barlist">
      {items.map((it) => (
        <li key={it.name} title={`${it.count} cliques`}>
          <span className="barlist__bar" style={{ width: `${(it.count / max) * 100}%` }} />
          <span className="barlist__name">{label(it.name)}</span>
          <span className="barlist__value">
            {it.count.toLocaleString('pt-BR')}
            <small>{total ? Math.round((it.count / total) * 100) : 0}%</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
