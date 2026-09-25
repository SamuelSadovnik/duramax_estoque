/** Linhas de carregamento no lugar da tabela vazia */
export function LinhasCarregando({ colunas, linhas = 3 }: { colunas: number; linhas?: number }) {
  return (
    <>
      {Array.from({ length: linhas }, (_, i) => (
        <tr key={i} className="linha-carregando" aria-hidden>
          {Array.from({ length: colunas }, (_, j) => <td key={j}><span className="esqueleto" style={{ width: `${40 + ((i * 7 + j * 13) % 45)}%` }} /></td>)}
        </tr>
      ))}
    </>
  );
}
export const Esqueleto = ({ largura = 60 }: { largura?: number }) => <span className="esqueleto" style={{ width: largura }} aria-hidden />;
