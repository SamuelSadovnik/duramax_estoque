import { useEffect, type ReactNode } from 'react';

export default function Modal({ titulo, onFechar, children, largo }: { titulo: string; onFechar: () => void; children: ReactNode; largo?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className={`modal ${largo ? 'largo' : ''}`} role="dialog" aria-label={titulo}>
        <header>
          <h2>{titulo}</h2>
          <button className="fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </header>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>
  );
}
