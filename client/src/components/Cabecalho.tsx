import type { ReactNode } from 'react';

export default function Cabecalho({ sobre, titulo, descricao, acoes }: { sobre?: string; titulo: string; descricao?: ReactNode; acoes?: ReactNode }) {
  return (
    <header className="cabecalho">
      <div>
        {sobre && <div className="sobre">{sobre}</div>}
        <h1>{titulo}</h1>
        {descricao && <p className="descricao">{descricao}</p>}
      </div>
      {acoes && <div className="cabecalho-acoes">{acoes}</div>}
    </header>
  );
}
