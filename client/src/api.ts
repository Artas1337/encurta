import type { Link, Overview, Stats, User } from './types';

const TOKEN_KEY = 'encurta.token';

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* armazenamento indisponível: sessão dura só até recarregar */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* idem */
    }
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const LOGOUT_EVENT = 'encurta:logout';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      tokenStore.clear();
      window.dispatchEvent(new Event(LOGOUT_EVENT));
    }
    // Erros de validação do Zod: mostra a primeira mensagem de campo, que é a mais útil.
    const fieldMsg = data.details ? (Object.values(data.details).flat()[0] as string | undefined) : undefined;
    throw new ApiError(res.status, fieldMsg ?? data.error ?? 'Algo deu errado. Tente novamente.');
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

interface AuthResponse {
  token: string;
  user: User;
}

export interface NewLink {
  url: string;
  alias?: string;
  title?: string;
  expiresAt?: string;
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>('POST', '/auth/register', { name, email, password }),
  login: (email: string, password: string) => request<AuthResponse>('POST', '/auth/login', { email, password }),
  me: () => request<{ user: User }>('GET', '/auth/me'),

  overview: () => request<Overview>('GET', '/overview'),
  listLinks: (q = '') => request<Link[]>('GET', `/links${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createLink: (data: NewLink) => request<Link>('POST', '/links', data),
  updateLink: (id: number, data: { url?: string; title?: string | null; expiresAt?: string | null }) =>
    request<Link>('PATCH', `/links/${id}`, data),
  deleteLink: (id: number) => request<void>('DELETE', `/links/${id}`),
  stats: (id: number, days: number) => request<Stats>('GET', `/links/${id}/stats?days=${days}`),

  /** URLs que o navegador busca sozinho (img / EventSource), então levam o token na query. */
  qrUrl: (id: number) => `/api/links/${id}/qr.svg?token=${tokenStore.get() ?? ''}`,
  liveUrl: (id: number) => `/api/links/${id}/live?token=${tokenStore.get() ?? ''}`,
};
