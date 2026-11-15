import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarPendentes, propagarEdicao, marcarPulada, competenciasDevidas } from '../js/recorrencia.js';

const rec = (o = {}) => ({
  id: 'r1', carteiraId: 'neg', tipo: 'saida', valorCentavos: 9900, categoriaId: 'fer',
  descricao: 'Assinatura', diaDoMes: 10, inicio: '2026-01-01', ativa: true, ...o,
});

test('gera mês atual e próximo como pendentes', () => {
  const novos = gerarPendentes([rec()], [], '2026-11-15');
  assert.deepEqual(novos.map((l) => [l.competencia, l.data, l.status]), [
    ['2026-11', '2026-11-10', 'pendente'],
    ['2026-12', '2026-12-10', 'pendente'],
  ]);
});

test('rodar duas vezes não duplica', () => {
  const r = [rec()];
  const primeira = gerarPendentes(r, [], '2026-11-15');
  const segunda = gerarPendentes(r, primeira, '2026-11-15');
  assert.equal(segunda.length, 0);
  // pago também conta como existente
  const pagos = primeira.map((l) => ({ ...l, status: 'pago' }));
  assert.equal(gerarPendentes(r, pagos, '2026-11-20').length, 0);
});

test('dia 31 em fevereiro vira último dia do mês', () => {
  const novos = gerarPendentes([rec({ diaDoMes: 31 })], [], '2026-01-20');
  assert.deepEqual(novos.map((l) => l.data), ['2026-01-31', '2026-02-28']);
  const bissexto = gerarPendentes([rec({ diaDoMes: 31 })], [], '2028-02-01');
  assert.equal(bissexto[0].data, '2028-02-29');
});

test('respeita início, fim, inativa e virada de ano', () => {
  assert.deepEqual(competenciasDevidas(rec({ inicio: '2026-11-20' }), '2026-11-15'), ['2026-12']);
  assert.deepEqual(competenciasDevidas(rec({ fim: '2026-11-30' }), '2026-11-15'), ['2026-11']);
  assert.deepEqual(competenciasDevidas(rec({ ativa: false }), '2026-11-15'), []);
  assert.deepEqual(competenciasDevidas(rec(), '2026-12-15'), ['2026-12', '2027-01']);
});

test('ocorrência excluída (pulada) não é regenerada', () => {
  const r = marcarPulada(rec(), '2026-11');
  const novos = gerarPendentes([r], [], '2026-11-15');
  assert.deepEqual(novos.map((l) => l.competencia), ['2026-12']);
});

test('edição propaga só para pendentes futuros', () => {
  const lancs = [
    { id: 'a', recorrenciaId: 'r1', competencia: '2026-10', data: '2026-10-10', status: 'pago', valorCentavos: 9900 },
    { id: 'b', recorrenciaId: 'r1', competencia: '2026-11', data: '2026-11-10', status: 'pendente', valorCentavos: 9900 },
    { id: 'c', recorrenciaId: 'r1', competencia: '2026-12', data: '2026-12-10', status: 'pendente', valorCentavos: 9900 },
  ];
  const alterados = propagarEdicao(rec({ valorCentavos: 12900, diaDoMes: 15 }), lancs, '2026-11-12');
  assert.deepEqual(alterados.map((l) => [l.id, l.valorCentavos, l.data]), [['c', 12900, '2026-12-15']]);
});
