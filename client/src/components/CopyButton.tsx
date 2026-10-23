import { useState } from 'react';

export function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt('Copie o link:', text);
    }
  };
  return (
    <button type="button" className={`btn btn--ghost btn--sm ${copied ? 'is-copied' : ''} ${className}`} onClick={copy}>
      {copied ? 'Copiado ✓' : 'Copiar'}
    </button>
  );
}
