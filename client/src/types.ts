export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Link {
  id: number;
  code: string;
  url: string;
  title: string | null;
  expires_at: string | null;
  created_at: string;
  short_url: string;
  clicks?: number;
  last_click?: string | null;
}

export interface Count {
  name: string;
  count: number;
}

export interface Click {
  at: string;
  referrer: string;
  browser: string;
  os: string;
  device: string;
}

export interface DayPoint {
  date: string;
  clicks: number;
  unique_visitors: number;
}

export interface Stats {
  link: Link;
  days: number;
  clicks: number;
  unique_visitors: number;
  series: DayPoint[];
  referrers: Count[];
  browsers: Count[];
  os: Count[];
  devices: Count[];
  recent: Click[];
}

export interface Overview {
  links: number;
  clicks: number;
  clicks_today: number;
}
