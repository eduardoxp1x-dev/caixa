// Cada tela recebe o estado e devolve HTML. Eventos são tratados por delegação em app.js.
import {
  TUDO, saldoRealizado, projecaoFimDoMes, totaisDoMes, porCategoria, serieMensal,
  pendentesAte, daCarteira, formatarBRL,
} from './calc.js';
import { competenciaDe, rotuloMesLongo, rotuloData, addDias } from './datas.js';
import { esc, itemLancamento, vazio, corCategoria, nomeCarteira, ordenarCategorias } from './ui.js';
import { rosca, barras } from './graficos-svg.js';

const BRL = (v) => esc(formatarBRL(v));

function navMes(estado) {
  return `<div class="nav-mes">
    <button class="icone" data-acao="mes" data-delta="-1" aria-label="Mês anterior">‹</button>
    <strong>${esc(rotuloMesLongo(estado.mes))}</strong>
    <button class="icone" data-acao="mes" data-delta="1" aria-label="Próximo mês">›</button>
  </div>`;
}

function avisoBackup(estado) {
  if (!estado.lancamentos.length) return '';
  const ult = estado.ultimoBackup;
  const dias = ult ? Math.floor((Date.now() - new Date(ult).getTime()) / 86400000) : null;
  if (dias != null && dias < 7) return '';
  const txt = dias == null ? 'Você ainda não fez nenhum backup.' : `Último backup há ${dias} dias.`;
  return `<div class="aviso">
    <span>${esc(txt)} Os dados ficam só neste aparelho.</span>
    <button data-acao="exportar">Fazer backup</button>
  </div>`;
}

export function inicio(estado) {
  const { lancamentos: L, carteira, hoje } = estado;
  const mesAtual = competenciaDe(hoje);
  const saldo = saldoRealizado(L, carteira);
  const proj = projecaoFimDoMes(L, carteira, mesAtual);
  const t = totaisDoMes(L, carteira, mesAtual);
  const proximas = pendentesAte(L, carteira, hoje, 7);
  const ultimos = daCarteira(L, carteira)
    .filter((l) => l.status === 'pago')
    .sort((a, b) => (b.data + (b.criadoEm ?? '')).localeCompare(a.data + (a.criadoEm ?? '')))
    .slice(0, 6);

  return `
    ${avisoBackup(estado)}
    <section class="cartao destaque">
      <span class="rotulo">Saldo atual</span>
      <span class="grande ${saldo < 0 ? 'neg' : ''}">${BRL(saldo)}</span>
      <span class="sub">Projeção no fim de ${esc(rotuloMesLongo(mesAtual).split(' ')[0].toLowerCase())}, com o que está pendente:
        <strong class="${proj < 0 ? 'neg' : ''}">${BRL(proj)}</strong></span>
    </section>
    <section class="trio">
      <div><span class="rotulo">Entrou</span><span class="valor entrada">${BRL(t.entradas)}</span></div>
      <div><span class="rotulo">Saiu</span><span class="valor saida">${BRL(t.saidas)}</span></div>
      <div><span class="rotulo">Resultado</span><span class="valor ${t.resultado < 0 ? 'saida' : 'entrada'}">${BRL(t.resultado)}</span></div>
    </section>
    <section>
      <div class="titulo-secao"><h2>Vence em 7 dias</h2>
        <button class="link" data-acao="tela" data-tela="contas">Ver todas</button></div>
      ${proximas.length ? `<ul class="lista">${proximas.map((l) => itemLancamento(estado, l, { botaoPagar: true })).join('')}</ul>`
        : vazio('Nada pendente para os próximos 7 dias.')}
    </section>
    <section>
      <div class="titulo-secao"><h2>Últimos lançamentos</h2>
        <button class="link" data-acao="tela" data-tela="extrato">Extrato</button></div>
      ${ultimos.length ? `<ul class="lista">${ultimos.map((l) => itemLancamento(estado, l)).join('')}</ul>`
        : vazio('Nenhum lançamento ainda. Toque em + para registrar o primeiro.')}
    </section>`;
}

export function extrato(estado) {
  const { lancamentos: L, carteira, mes, filtro } = estado;
  let lista = daCarteira(L, carteira).filter((l) => competenciaDe(l.data) === mes);
  if (filtro.tipo !== 'todos') lista = lista.filter((l) => l.tipo === filtro.tipo);
  if (filtro.categoriaId) lista = lista.filter((l) => l.categoriaId === filtro.categoriaId);
  lista.sort((a, b) => b.data.localeCompare(a.data));
  const t = totaisDoMes(lista, carteira, mes, { incluirPendentes: true });

  const porDia = new Map();
  for (const l of lista) {
    if (!porDia.has(l.data)) porDia.set(l.data, []);
    porDia.get(l.data).push({ ...l, atrasado: l.status === 'pendente' && l.data < estado.hoje });
  }
  const cats = estado.categorias.filter((c) => carteira === TUDO || c.carteiraId === carteira);
  const chip = (v, txt) => `<button class="chip ${filtro.tipo === v ? 'ativo' : ''}" data-acao="filtro-tipo" data-v="${v}">${txt}</button>`;

  return `
    ${navMes(estado)}
    <div class="filtros">
      ${chip('todos', 'Todos')}${chip('entrada', 'Entradas')}${chip('saida', 'Saídas')}
      <select data-acao="filtro-categoria" aria-label="Categoria">
        <option value="">Todas categorias</option>
        ${cats.map((c) => `<option value="${esc(c.id)}" ${filtro.categoriaId === c.id ? 'selected' : ''}>${esc(c.nome)}${carteira === TUDO ? ` (${esc(nomeCarteira(estado, c.carteiraId))})` : ''}</option>`).join('')}
      </select>
    </div>
    <p class="resumo">Entradas <span class="valor entrada">${BRL(t.entradas)}</span> ·
      Saídas <span class="valor saida">${BRL(t.saidas)}</span></p>
    ${lista.length ? [...porDia.entries()].map(([data, ls]) => `
      <h3 class="dia">${esc(rotuloData(data))}</h3>
      <ul class="lista">${ls.map((l) => itemLancamento(estado, l, { mostrarData: false, botaoPagar: true })).join('')}</ul>`).join('')
      : vazio('Nenhum lançamento neste mês.')}`;
}

export function contas(estado) {
  const { lancamentos: L, carteira, hoje } = estado;
  const todas = pendentesAte(L, carteira, hoje, null);
  const limite7 = addDias(hoje, 7);
  const grupos = [
    ['Atrasadas', todas.filter((l) => l.atrasado)],
    ['Próximos 7 dias', todas.filter((l) => !l.atrasado && l.data <= limite7)],
    ['Depois', todas.filter((l) => l.data > limite7)],
  ];
  const aPagar = todas.filter((l) => l.tipo === 'saida' && !l.transferenciaId).reduce((s, l) => s + l.valorCentavos, 0);
  const aReceber = todas.filter((l) => l.tipo === 'entrada' && !l.transferenciaId).reduce((s, l) => s + l.valorCentavos, 0);
  return `
    <section class="trio dois">
      <div><span class="rotulo">A pagar</span><span class="valor saida">${BRL(aPagar)}</span></div>
      <div><span class="rotulo">A receber</span><span class="valor entrada">${BRL(aReceber)}</span></div>
    </section>
    ${todas.length ? grupos.filter(([, ls]) => ls.length).map(([titulo, ls]) => `
      <h2 class="${titulo === 'Atrasadas' ? 'neg' : ''}">${titulo}</h2>
      <ul class="lista">${ls.map((l) => itemLancamento(estado, l, { botaoPagar: true })).join('')}</ul>`).join('')
      : vazio('Nenhuma conta pendente. Lançamentos marcados como "não pago" e recorrentes aparecem aqui.')}`;
}

export function graficos(estado) {
  const { lancamentos: L, carteira, mes, tipoGrafico } = estado;
  const cats = porCategoria(L, carteira, mes, tipoGrafico);
  const total = cats.reduce((s, c) => s + c.total, 0);
  const fatias = cats.map((c) => ({
    nome: c.categoriaId === '__transferencia' ? 'Transferências'
      : estado.categorias.find((x) => x.id === c.categoriaId)?.nome ?? 'Sem categoria',
    valor: c.total,
    cor: corCategoria(estado, c.categoriaId),
  }));
  const serie = serieMensal(L, carteira, mes, 6);
  const seg = (v, txt) => `<button class="chip ${tipoGrafico === v ? 'ativo' : ''}" data-acao="tipo-grafico" data-v="${v}">${txt}</button>`;
  return `
    ${navMes(estado)}
    <section class="cartao">
      <div class="titulo-secao"><h2>Por categoria</h2><div>${seg('saida', 'Saídas')}${seg('entrada', 'Entradas')}</div></div>
      <div class="rosca-wrap">
        ${rosca(fatias, { rotuloCentro: tipoGrafico === 'saida' ? 'Saídas' : 'Entradas', valorCentro: formatarBRL(total) })}
      </div>
      ${fatias.length ? `<ul class="legenda">${fatias.map((f) => `
        <li><span class="ponto" style="background:${esc(f.cor)}"></span><span>${esc(f.nome)}</span>
          <span class="pct">${Math.round((f.valor / total) * 100)}%</span><span class="valor">${BRL(f.valor)}</span></li>`).join('')}</ul>`
        : vazio('Sem lançamentos pagos neste mês.')}
    </section>
    <section class="cartao">
      <h2>Últimos 6 meses</h2>
      ${barras(serie)}
      <div class="legenda-barras"><span><i class="barra-entrada"></i>Entradas</span><span><i class="barra-saida"></i>Saídas</span></div>
    </section>`;
}

export function ajustes(estado) {
  const ult = estado.ultimoBackup ? new Date(estado.ultimoBackup).toLocaleString('pt-BR') : 'nunca';
  const recs = estado.recorrencias.filter((r) => estado.carteira === TUDO || r.carteiraId === estado.carteira);
  const carteiras = estado.carteiras.filter((c) => estado.carteira === TUDO || c.id === estado.carteira);
  return `
    <section class="cartao">
      <h2>Backup</h2>
      <p class="sub">Os dados ficam só neste aparelho. Se você limpar os dados do navegador, eles somem. Último backup: <strong>${esc(ult)}</strong>.</p>
      <div class="botoes">
        <button class="primario" data-acao="exportar">Baixar backup</button>
        <button data-acao="importar">Restaurar backup</button>
      </div>
      <input type="file" id="arquivo-backup" accept="application/json,.json" hidden>
    </section>
    <section class="cartao">
      <h2>Recorrentes</h2>
      ${recs.length ? `<ul class="lista">${recs.map((r) => `
        <li class="item ${r.ativa ? '' : 'inativa'}">
          <button class="item-corpo" data-acao="editar-recorrencia" data-id="${esc(r.id)}">
            <span class="ponto" style="background:${esc(corCategoria(estado, r.categoriaId))}"></span>
            <span class="item-texto">
              <span class="item-titulo">${esc(r.descricao || estado.categorias.find((c) => c.id === r.categoriaId)?.nome || 'Recorrente')}</span>
              <span class="item-sub">Todo dia ${r.diaDoMes}${estado.carteira === TUDO ? ' · ' + esc(nomeCarteira(estado, r.carteiraId)) : ''}${r.ativa ? '' : ' · pausada'}</span>
            </span>
            <span class="valor ${r.tipo}">${r.tipo === 'entrada' ? '+' : '−'} ${BRL(r.valorCentavos)}</span>
          </button>
        </li>`).join('')}</ul>`
        : vazio('Nenhuma recorrência. Marque "Repetir todo mês" ao criar um lançamento.')}
    </section>
    ${carteiras.map((cart) => `
    <section class="cartao">
      <h2>Categorias · ${esc(cart.nome)}</h2>
      ${['saida', 'entrada'].map((tipo) => `
        <h3 class="dia">${tipo === 'saida' ? 'Saídas' : 'Entradas'}</h3>
        <div class="tags">
          ${ordenarCategorias(estado.categorias.filter((c) => c.carteiraId === cart.id && c.tipo === tipo)).map((c) => `
            <span class="tag"><span class="ponto" style="background:${esc(c.cor)}"></span>${esc(c.nome)}
              <button class="x" data-acao="excluir-categoria" data-id="${esc(c.id)}" aria-label="Excluir ${esc(c.nome)}">×</button></span>`).join('')}
          <button class="tag nova" data-acao="nova-categoria" data-carteira="${esc(cart.id)}" data-tipo="${tipo}">+ nova</button>
        </div>`).join('')}
    </section>`).join('')}
    <p class="rodape">Caixa v1 · dados locais (IndexedDB)</p>`;
}
