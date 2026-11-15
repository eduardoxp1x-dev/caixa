// Geração idempotente de lançamentos recorrentes (funções puras).
import { competenciaDe, addMeses, dataNaCompetencia } from './datas.js';
import { uid } from './uid.js';

// Competências que devem existir para esta recorrência na janela [mesAtual, mesAtual+mesesAFrente].
export function competenciasDevidas(rec, hoje, mesesAFrente = 1) {
  if (!rec.ativa) return [];
  const atual = competenciaDe(hoje);
  const inicio = competenciaDe(rec.inicio);
  const fim = rec.fim ? competenciaDe(rec.fim) : null;
  const puladas = new Set(rec.puladas ?? []);
  const out = [];
  for (let i = 0; i <= mesesAFrente; i++) {
    const comp = addMeses(atual, i);
    if (comp < inicio) continue;
    if (fim && comp > fim) continue;
    if (puladas.has(comp)) continue;
    const data = dataNaCompetencia(comp, rec.diaDoMes);
    if (data < rec.inicio) continue; // ex.: início dia 20, recorrência dia 5 do mesmo mês
    if (rec.fim && data > rec.fim) continue;
    out.push(comp);
  }
  return out;
}

export function instanciar(rec, competencia) {
  return {
    id: uid(),
    carteiraId: rec.carteiraId,
    tipo: rec.tipo,
    valorCentavos: rec.valorCentavos,
    categoriaId: rec.categoriaId,
    descricao: rec.descricao,
    data: dataNaCompetencia(competencia, rec.diaDoMes),
    status: 'pendente',
    recorrenciaId: rec.id,
    competencia,
  };
}

// Retorna somente os lançamentos NOVOS a criar. Chave: recorrenciaId + competencia.
export function gerarPendentes(recorrencias, lancamentos, hoje, mesesAFrente = 1) {
  const existentes = new Set(
    lancamentos.filter((l) => l.recorrenciaId).map((l) => `${l.recorrenciaId}|${l.competencia}`)
  );
  const novos = [];
  for (const rec of recorrencias) {
    for (const comp of competenciasDevidas(rec, hoje, mesesAFrente)) {
      const chave = `${rec.id}|${comp}`;
      if (existentes.has(chave)) continue;
      existentes.add(chave);
      novos.push(instanciar(rec, comp));
    }
  }
  return novos;
}

// Ao editar a recorrência: atualiza só ocorrências pendentes com data >= hoje.
// Retorna a lista de lançamentos alterados.
export function propagarEdicao(rec, lancamentos, hoje) {
  return lancamentos
    .filter((l) => l.recorrenciaId === rec.id && l.status === 'pendente' && l.data >= hoje)
    .map((l) => ({
      ...l,
      carteiraId: rec.carteiraId,
      tipo: rec.tipo,
      valorCentavos: rec.valorCentavos,
      categoriaId: rec.categoriaId,
      descricao: rec.descricao,
      data: dataNaCompetencia(l.competencia, rec.diaDoMes),
    }));
}

// Ao excluir uma ocorrência gerada, marca a competência como pulada para não regenerar.
export function marcarPulada(rec, competencia) {
  const puladas = new Set(rec.puladas ?? []);
  puladas.add(competencia);
  return { ...rec, puladas: [...puladas].sort() };
}
