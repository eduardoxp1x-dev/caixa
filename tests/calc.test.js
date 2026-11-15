import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  saldoRealizado, saldoProjetado, totaisDoMes, porCategoria, serieMensal,
  pendentesAte, parseValor, TUDO,
} from '../js/calc.js';
import { criarTransferencia } from '../js/transferencia.js';

const L = (o) => ({ id: Math.random().toString(), status: 'pago', categoriaId: 'c', ...o });

const base = [
  L({ carteiraId: 'pes', tipo: 'entrada', valorCentavos: 500000, data: '2026-11-05', categoriaId: 'sal' }),
  L({ carteiraId: 'pes', tipo: 'saida', valorCentavos: 120000, data: '2026-11-10', categoriaId: 'mor' }),
  L({ carteiraId: 'neg', tipo: 'entrada', valorCentavos: 800000, data: '2026-11-03', categoriaId: 'ven' }),
  L({ carteiraId: 'neg', tipo: 'saida', valorCentavos: 300000, data: '2026-11-04', categoriaId: 'ads' }),
  L({ carteiraId: 'neg', tipo: 'saida', valorCentavos: 50000, data: '2026-11-20', status: 'pendente', categoriaId: 'ads' }),
  L({ carteiraId: 'neg', tipo: 'saida', valorCentavos: 10000, data: '2026-11-01', status: 'pendente', categoriaId: 'fer' }),
  L({ carteiraId: 'neg', tipo: 'saida', valorCentavos: 99900, data: '2026-12-10', status: 'pendente', categoriaId: 'fer' }),
];

test('saldo realizado por carteira e consolidado ignora pendentes', () => {
  assert.equal(saldoRealizado(base, 'pes'), 380000);
  assert.equal(saldoRealizado(base, 'neg'), 500000);
  assert.equal(saldoRealizado(base, TUDO), 880000);
});

test('saldo projetado inclui pendentes até a data, inclusive atrasados', () => {
  assert.equal(saldoProjetado(base, 'neg', '2026-11-30'), 500000 - 50000 - 10000);
  assert.equal(saldoProjetado(base, 'neg', '2026-12-31'), 500000 - 50000 - 10000 - 99900);
});

test('totais do mês contam só pagos por padrão', () => {
  assert.deepEqual(totaisDoMes(base, 'neg', '2026-11'), { entradas: 800000, saidas: 300000, resultado: 500000 });
  assert.equal(totaisDoMes(base, 'neg', '2026-11', { incluirPendentes: true }).saidas, 360000);
});

test('transferência não altera saldo consolidado nem aparece como fluxo no consolidado', () => {
  const tr = criarTransferencia({
    deCarteiraId: 'neg', paraCarteiraId: 'pes', valorCentavos: 200000,
    data: '2026-11-15', status: 'pago',
  });
  const todos = [...base, ...tr];
  assert.equal(saldoRealizado(todos, TUDO), saldoRealizado(base, TUDO));
  assert.equal(saldoRealizado(todos, 'neg'), 300000);
  assert.equal(saldoRealizado(todos, 'pes'), 580000);
  assert.deepEqual(totaisDoMes(todos, TUDO, '2026-11'), totaisDoMes(base, TUDO, '2026-11'));
  // na carteira individual, aparece como fluxo
  assert.equal(totaisDoMes(todos, 'pes', '2026-11').entradas, 700000);
  assert.equal(porCategoria(todos, TUDO, '2026-11', 'saida').some((c) => c.categoriaId === '__transferencia'), false);
  assert.equal(porCategoria(todos, 'neg', '2026-11', 'saida').some((c) => c.categoriaId === '__transferencia'), true);
});

test('por categoria ordena do maior para o menor', () => {
  const r = porCategoria(base, TUDO, '2026-11', 'saida');
  assert.deepEqual(r, [{ categoriaId: 'ads', total: 300000 }, { categoriaId: 'mor', total: 120000 }]);
});

test('série mensal cobre n meses em ordem cronológica e cruza o ano', () => {
  const s = serieMensal(base, TUDO, '2027-01', 3);
  assert.deepEqual(s.map((x) => x.mes), ['2026-11', '2026-12', '2027-01']);
  assert.equal(s[0].entradas, 1300000);
  assert.equal(s[1].saidas, 0);
});

test('pendentes até: atrasados marcados e ordenados', () => {
  const p = pendentesAte(base, 'neg', '2026-11-15', 7);
  assert.deepEqual(p.map((x) => [x.data, x.atrasado]), [['2026-11-01', true], ['2026-11-20', false]]);
  const curto = pendentesAte(base, 'neg', '2026-11-15', 3);
  assert.deepEqual(curto.map((x) => x.data), ['2026-11-01']);
  const todos = pendentesAte(base, 'neg', '2026-11-15', null);
  assert.equal(todos.length, 3);
});

test('parseValor aceita formatos BR e rejeita lixo', () => {
  assert.equal(parseValor('12,34'), 1234);
  assert.equal(parseValor('1.234,56'), 123456);
  assert.equal(parseValor('1234.56'), 123456);
  assert.equal(parseValor('1.234'), 123400);
  assert.equal(parseValor('R$ 50'), 5000);
  assert.equal(parseValor('0,1'), 10);
  assert.equal(parseValor('0'), null);
  assert.equal(parseValor('abc'), null);
  assert.equal(parseValor('1,234'), null);
  assert.equal(parseValor(''), null);
});
