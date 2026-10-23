// Mesmas regras de cadastro da API (server/src/auth.ts), para avisar antes de enviar.

const EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'outlook.com', 'outlook.com.br', 'hotmail.com', 'hotmail.com.br', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.com.br', 'ymail.com',
  'icloud.com', 'me.com', 'mac.com',
  'proton.me', 'protonmail.com',
  'uol.com.br', 'bol.com.br', 'terra.com.br', 'ig.com.br',
  'aol.com', 'gmx.com', 'zoho.com',
];

export const isCommonEmail = (email: string) =>
  EMAIL_DOMAINS.includes(email.trim().toLowerCase().split('@')[1] ?? '');

export const PASSWORD_RULES = [
  { label: '10 caracteres ou mais', test: (p: string) => p.length >= 10 },
  { label: 'Letra maiúscula', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Letra minúscula', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Número', test: (p: string) => /\d/.test(p) },
  { label: 'Símbolo (! @ # $ …)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];
