// Funções puras de cálculo. Valores sempre em centavos (inteiros).
import { competenciaDe, addMeses, fimDoMes, addDias } from './datas.js';

export const TUDO = 'tudo';

const sinal = (l) => (l.tipo === 'entrada' ? l.valorCentavos : -l.valorCentavos);

export function daCarteira(lancamentos, carteiraId) {
  if (carteiraId === TUDO) return lancamentos;
  return lancamentos.filter((l) => l.carteiraId === carteiraId);
}

// Na visão consolidada, transferências entre carteiras não são receita nem gasto.
function contaComoFluxo(l, carteiraId) {
  return !(carteiraId === TUDO && l.transferenciaId);
}

// Saldo de tudo que já foi pago (acumulado, sem limite de data).
export function saldoRealizado(lancamentos, carteiraId) {
  return daCarteira(lancamentos, carteiraId)
    .filter((l) => l.status === 'pago')
    .reduce((s, l) => s + sinal(l), 0);
}

// Saldo realizado + pendentes com vencimento até `ate` (inclui atrasados).
export function saldoProjetado(lancamentos, carteiraId, ate) {
  const pend = daCarteira(lancamentos, carteiraId)
    .filter((l) => l.status === 'pendente' && l.data <= ate)
    .reduce((s, l) => s + sinal(l), 0);
  return saldoRealizado(lancamentos, carteiraId) + pend;
}

export function totaisDoMes(lancamentos, carteiraId, competencia, { incluirPendentes = false } = {}) {
  let entradas = 0;
  let saidas = 0;
  for (const l of daCarteira(lancamentos, carteiraId)) {
    if (competenciaDe(l.data) !== competencia) continue;
    if (!incluirPendentes && l.status !== 'pago') continue;
    if (!contaComoFluxo(l, carteiraId)) continue;
    if (l.tipo === 'entrada') entradas += l.valorCentavos;
    else saidas += l.valorCentavos;
  }
  return { entradas, saidas, resultado: entradas - saidas };
}

// [{categoriaId, total}] ordenado do maior para o menor. Só pagos.
export function porCategoria(lancamentos, carteiraId, competencia, tipo) {
  const mapa = new Map();
  for (const l of daCarteira(lancamentos, carteiraId)) {
    if (l.tipo !== tipo || l.status !== 'pago') continue;
    if (competenciaDe(l.data) !== competencia) continue;
    if (!contaComoFluxo(l, carteiraId)) continue;
    const chave = l.transferenciaId ? '__transferencia' : (l.categoriaId ?? '__sem');
    mapa.set(chave, (mapa.get(chave) ?? 0) + l.valorCentavos);
  }
  return [...mapa.entries()]
    .map(([categoriaId, total]) => ({ categoriaId, total }))
    .sort((a, b) => b.total - a.total);
}

// Últimos `n` meses terminando em `competenciaFinal`, em ordem cronológica.
export function serieMensal(lancamentos, carteiraId, competenciaFinal, n = 6) {
  const serie = [];
  for (let i = n - 1; i >= 0; i--) {
    const mes = addMeses(competenciaFinal, -i);
    const { entradas, saidas } = totaisDoMes(lancamentos, carteiraId, mes);
    serie.push({ mes, entradas, saidas });
  }
  return serie;
}

// Pendentes vencendo até hoje + dias (atrasados inclusos), por data.
export function pendentesAte(lancamentos, carteiraId, hoje, dias) {
  const limite = dias == null ? '9999-12-31' : addDias(hoje, dias);
  return daCarteira(lancamentos, carteiraId)
    .filter((l) => l.status === 'pendente' && l.data <= limite)
    .map((l) => ({ ...l, atrasado: l.data < hoje }))
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

export function projecaoFimDoMes(lancamentos, carteiraId, competencia) {
  return saldoProjetado(lancamentos, carteiraId, fimDoMes(competencia));
}

// ---- Formatação e entrada de valores ----

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarBRL(centavos) {
  return fmt.format(centavos / 100);
}

// Aceita "12,34", "1.234,56", "1234.56", "1.234", "R$ 50". Retorna centavos ou null.
export function parseValor(texto) {
  if (texto == null) return null;
  let s = String(texto).replace(/R\$|\s/g, '');
  if (!s) return null;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const centavos = Math.round(Number(s) * 100);
  return centavos > 0 ? centavos : null;
}

export function centavosParaTexto(centavos) {
  return (centavos / 100).toFixed(2).replace('.', ',');
}
