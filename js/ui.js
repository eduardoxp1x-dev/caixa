import { formatarBRL, TUDO } from './calc.js';
import { rotuloData } from './datas.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

// Alfabética, com "Outros"/"Outras ..." sempre por último.
export function ordenarCategorias(cats) {
  const peso = (c) => (/^outr/i.test(c.nome) ? 1 : 0);
  return [...cats].sort((a, b) => peso(a) - peso(b) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function nomeCategoria(estado, l) {
  if (l.transferenciaId) return 'Transferência';
  return estado.categorias.find((c) => c.id === l.categoriaId)?.nome ?? 'Sem categoria';
}

export function corCategoria(estado, id) {
  if (id === '__transferencia') return '#8a8f98';
  return estado.categorias.find((c) => c.id === id)?.cor ?? '#8a8f98';
}

export function nomeCarteira(estado, id) {
  return estado.carteiras.find((c) => c.id === id)?.nome ?? '';
}

export function valorAssinado(l) {
  const s = l.tipo === 'entrada' ? '+' : '−';
  return `<span class="valor ${l.tipo}">${s} ${esc(formatarBRL(l.valorCentavos))}</span>`;
}

export function itemLancamento(estado, l, { mostrarData = true, botaoPagar = false } = {}) {
  const cat = nomeCategoria(estado, l);
  const titulo = l.descricao || cat;
  const partes = [];
  if (l.descricao) partes.push(cat);
  if (estado.carteira === TUDO) partes.push(nomeCarteira(estado, l.carteiraId));
  if (mostrarData) partes.push(rotuloData(l.data));
  const cor = l.transferenciaId ? '#8a8f98' : corCategoria(estado, l.categoriaId);
  const pend = l.status === 'pendente'
    ? `<span class="badge ${l.atrasado ? 'atrasado' : ''}">${l.atrasado ? 'atrasado' : (l.tipo === 'entrada' ? 'a receber' : 'a pagar')}</span>`
    : '';
  const rec = l.recorrenciaId ? '<span class="rec" title="Recorrente">↻</span>' : '';
  const pagar = botaoPagar && l.status === 'pendente'
    ? `<button class="btn-pagar" data-acao="pagar" data-id="${esc(l.id)}">${l.tipo === 'entrada' ? 'Recebi' : 'Paguei'}</button>`
    : '';
  return `
    <li class="item ${l.status}">
      <button class="item-corpo" data-acao="editar" data-id="${esc(l.id)}">
        <span class="ponto" style="background:${esc(cor)}"></span>
        <span class="item-texto">
          <span class="item-titulo">${esc(titulo)} ${rec}</span>
          <span class="item-sub">${pend} ${esc(partes.join(' · '))}</span>
        </span>
        ${valorAssinado(l)}
      </button>
      ${pagar}
    </li>`;
}

export function vazio(texto) {
  return `<p class="vazio">${esc(texto)}</p>`;
}
