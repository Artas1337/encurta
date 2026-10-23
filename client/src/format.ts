/** 1234 → "1.234" · 12500 → "12,5 mil" */
export function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (n >= 10_000) return `${(n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return n.toLocaleString('pt-BR');
}

/** Data do SQLite ("2026-10-19 12:00:00") ou ISO → Date */
export const parseDate = (s: string) => new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

/** "agora", "há 5 minutos", "ontem"... */
export function timeAgo(s: string, now = Date.now()) {
  const sec = Math.round((parseDate(s).getTime() - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 45) return 'agora';
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  return rtf.format(Math.round(sec / 86400), 'day');
}

/** "2026-10-19" → "19 out" */
export const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).replace('.', '');

/** "https://www.exemplo.com/a/b?c" → "exemplo.com/a/b?c" */
export const prettyUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

export const DEVICE_LABEL: Record<string, string> = { desktop: 'Computador', mobile: 'Celular', tablet: 'Tablet' };
