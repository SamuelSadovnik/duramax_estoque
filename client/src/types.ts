export type Perfil = 'admin' | 'operador';
export interface Usuario {
  id: number; nome: string; login: string; perfil: Perfil; ativo?: number; criado_em?: string;
  trocar_senha?: number; senha_alterada_em?: string | null; bloqueado?: boolean;
}
export interface Produto {
  id: number; codigo: string; descricao: string; unidade: string; cod_barras: string | null;
  embalagem: number | null; ativo: number; saldo: number; a_caminho: number; sem_definicao: number; criado_em: string; atualizado_em: string;
}
export interface Motivo { id: number; nome: string; ativo: number }
export type StatusSac = 'ABERTO' | 'AGUARDANDO' | 'RECEBIDO' | 'SEM_RETORNO' | 'CANCELADO';
export interface Sac {
  id: number; numero: number; cliente: string; produto_id: number; quantidade: number;
  nf_venda: string | null; observacao: string | null; status: StatusSac; volta_fabrica: number | null;
  nf_entrada: string | null; data_entrada: string | null; qtd_recebida: number | null; resolucao: string | null;
  data_abertura: string; data_modificacao: string; data_conclusao: string | null; criado_por: number;
  produto_codigo: string; produto_descricao: string; produto_unidade: string; criado_por_nome: string;
  motivos: string | null; motivo_ids: string | null; dias: number;
}
export interface Log {
  id: number; data: string; usuario_id: number | null; usuario_nome: string | null;
  entidade: string; entidade_id: number | null; acao: string; detalhes: string | null;
}
export interface Movimentacao {
  id: number; produto_id: number; tipo: 'ENTRADA_SAC' | 'AJUSTE' | 'ESTORNO'; quantidade: number;
  nota: string | null; sac_id: number | null; motivo: string | null; estorno_de: number | null; estornada: number;
  data: string; usuario_id: number; usuario_nome: string; produto_codigo?: string; produto_descricao?: string;
  sac_numero?: number | null; sac_cliente?: string | null;
}
export interface SacDetalhe extends Sac { logs: Log[]; movimentacoes: Movimentacao[] }

export const STATUS_LABEL: Record<StatusSac, string> = {
  ABERTO: 'Sem definição', AGUARDANDO: 'A caminho da fábrica', RECEBIDO: 'Recebido na fábrica',
  SEM_RETORNO: 'Resolvido sem retorno', CANCELADO: 'Cancelado',
};
