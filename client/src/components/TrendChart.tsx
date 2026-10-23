import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { compact, dayLabel } from '../format';
import type { DayPoint } from '../types';

const H = 260;
const PAD = { top: 16, right: 16, bottom: 30, left: 44 };

/** Divisões inteiras e "redondas" (1, 2, 5 × 10^n) — contagens não têm casas decimais. */
function niceTicks(max: number, target = 4) {
  const raw = Math.max(max, 1) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!);
  return Array.from({ length: Math.ceil(Math.max(max, 1) / step) + 1 }, (_, i) => i * step);
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setW(ref.current.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/**
 * Cliques (área) e visitantes únicos (linha) por dia, no mesmo eixo — mesma unidade.
 * Hover: linha-guia vertical + pontos + tooltip com os dois valores.
 */
export function TrendChart({ data }: { data: DayPoint[] }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const plotW = Math.max(width - PAD.left - PAD.right, 50);
  const plotH = H - PAD.top - PAD.bottom;
  const ticks = niceTicks(Math.max(...data.map((d) => d.clicks)));
  const yMax = ticks.at(-1)!;
  const x = (i: number) => PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

  const line = (key: 'clicks' | 'unique_visitors') => data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d[key])}`).join('');
  const area = `${line('clicks')}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;

  // Rótulos do eixo X: ~6 datas espaçadas, sempre incluindo a última.
  const step = Math.max(1, Math.ceil(data.length / 6));
  const xTicks = data.map((_, i) => i).filter((i) => (data.length - 1 - i) % step === 0);

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    setHover(Math.round(rel * (data.length - 1)));
  };

  const h = hover !== null ? data[hover] : null;

  return (
    <div className="trend" ref={ref}>
      <ul className="legend">
        <li><i className="key key--clicks" />Cliques</li>
        <li><i className="key key--unique" />Visitantes únicos</li>
      </ul>
      <svg width={width} height={H} role="img" aria-label="Cliques e visitantes únicos por dia">
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'axis' : 'grid'} x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} />
            <text className="tick" x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{compact(t)}</text>
          </g>
        ))}
        {xTicks.map((i) => (
          <text key={i} className="tick" x={x(i)} y={H - 8} textAnchor={i === data.length - 1 ? 'end' : 'middle'}>
            {dayLabel(data[i].date)}
          </text>
        ))}

        <path className="area" d={area} />
        <path className="line line--clicks" d={line('clicks')} />
        <path className="line line--unique" d={line('unique_visitors')} />

        {h && hover !== null && (
          <g>
            <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} />
            <circle className="dot dot--clicks" cx={x(hover)} cy={y(h.clicks)} r={5} />
            <circle className="dot dot--unique" cx={x(hover)} cy={y(h.unique_visitors)} r={5} />
          </g>
        )}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {h && hover !== null && (
        <div className="tooltip" style={{ left: Math.min(Math.max(x(hover), 90), width - 90), top: y(h.clicks) + 24 }}>
          <strong>{dayLabel(h.date)}</strong>
          <span><i className="key key--clicks" />Cliques <b>{h.clicks}</b></span>
          <span><i className="key key--unique" />Únicos <b>{h.unique_visitors}</b></span>
        </div>
      )}
    </div>
  );
}
