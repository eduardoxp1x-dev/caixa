// Transferência entre carteiras = par saída/entrada com o mesmo transferenciaId.
import { uid } from './uid.js';

export function criarTransferencia({ deCarteiraId, paraCarteiraId, valorCentavos, data, status, descricao, nomes }) {
  const transferenciaId = uid();
  const base = { valorCentavos, data, status, transferenciaId, categoriaId: null };
  return [
    {
      ...base, id: uid(), carteiraId: deCarteiraId, tipo: 'saida',
      descricao: descricao || `Transferência → ${nomes?.[paraCarteiraId] ?? ''}`.trim(),
    },
    {
      ...base, id: uid(), carteiraId: paraCarteiraId, tipo: 'entrada',
      descricao: descricao || `Transferência ← ${nomes?.[deCarteiraId] ?? ''}`.trim(),
    },
  ];
}

export function parDaTransferencia(lancamentos, transferenciaId) {
  return lancamentos.filter((l) => l.transferenciaId === transferenciaId);
}
