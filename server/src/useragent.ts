/**
 * Parser de user-agent enxuto. Não tenta cobrir tudo: identifica as famílias
 * que importam num painel (≈99% do tráfego) e agrupa o resto em "Outro".
 * A ordem dos testes importa: Edge e Opera também dizem "Chrome", e o Chrome diz "Safari".
 */

export interface ParsedUA {
  browser: string;
  os: string;
  device: 'desktop' | 'mobile' | 'tablet';
  bot: boolean;
}

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python-requests|headless/i;

const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser/, 'Samsung Internet'],
  [/Firefox\/|FxiOS/, 'Firefox'],
  [/Chrome\/|CriOS/, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
  [/Windows/, 'Windows'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

export function parseUserAgent(ua = ''): ParsedUA {
  const find = (list: [RegExp, string][]) => list.find(([re]) => re.test(ua))?.[1] ?? 'Outro';
  const tablet = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua));
  const mobile = !tablet && /Mobi|iPhone|iPod|Android/.test(ua);
  return {
    browser: find(BROWSERS),
    os: find(SYSTEMS),
    device: tablet ? 'tablet' : mobile ? 'mobile' : 'desktop',
    bot: !ua || BOT.test(ua),
  };
}

/** "https://www.google.com/search?q=x" → "google.com"; vazio ou inválido → "direto". */
export function referrerHost(referrer?: string): string {
  if (!referrer) return 'direto';
  try {
    return new URL(referrer).hostname.replace(/^www\./, '') || 'direto';
  } catch {
    return 'direto';
  }
}
