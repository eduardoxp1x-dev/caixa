// Formulários exibidos na folha inferior (<dialog>).
import { centavosParaTexto } from './calc.js';
import { esc, ordenarCategorias } from './ui.js';

export function chipsCategorias(estado, carteiraId, tipo, selecionada) {
  const cats = ordenarCategorias(estado.categorias.filter((c) => c.carteiraId === carteiraId && c.tipo === tipo));
  if (!cats.length) return '<p class="sub">Nenhuma categoria. Crie em Ajustes.</p>';
  return cats.map((c) => `
    <label class="chip-radio">
      <input type="radio" name="categoriaId" value="${esc(c.id)}" ${c.id === selecionada ? 'checked' : ''} required>
      <span><i class="ponto" style="background:${esc(c.cor)}"></i>${esc(c.nome)}</span>
    </label>`).join('');
}

function opcoesCarteira(estado, sel) {
  return estado.carteiras.map((c) => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');
}

// lanc: lançamento existente (edição) ou null. par: o outro lado, se for transferência.
export function formLancamento(estado, lanc, par) {
  const editando = !!lanc;
  const ehTransf = !!lanc?.transferenciaId;
  const tipo = ehTransf ? 'transferencia' : (lanc?.tipo ?? estado.ultimoTipo ?? 'saida');
  const carteiraId = lanc?.carteiraId ?? estado.ultimaCarteira ?? estado.carteiras[0]?.id;
  const de = ehTransf ? (lanc.tipo === 'saida' ? lanc.carteiraId : par?.carteiraId) : carteiraId;
  const para = ehTransf ? (lanc.tipo === 'entrada' ? lanc.carteiraId : par?.carteiraId)
    : estado.carteiras.find((c) => c.id !== carteiraId)?.id;
  const data = lanc?.data ?? estado.hoje;
  const pago = lanc ? lanc.status === 'pago' : true;
  const seg = (v, txt, desab) => `
    <label class="seg-op ${v}"><input type="radio" name="tipo" value="${v}" ${tipo === v ? 'checked' : ''} ${desab ? 'disabled' : ''}><span>${txt}</span></label>`;

  return `
  <form id="form-lanc" class="folha-form" data-id="${esc(lanc?.id ?? '')}" novalidate>
    <header class="folha-topo">
      <h2>${editando ? 'Editar lançamento' : 'Novo lançamento'}</h2>
      <button type="button" class="icone" data-acao="fechar" aria-label="Fechar">✕</button>
    </header>
    <div class="seg">
      ${seg('saida', 'Saída', ehTransf)}${seg('entrada', 'Entrada', ehTransf)}${seg('transferencia', 'Transferir', editando && !ehTransf)}
    </div>
    <label class="campo-valor">
      <span>R$</span>
      <input name="valor" inputmode="decimal" autocomplete="off" placeholder="0,00" ${editando ? '' : 'autofocus'}
        value="${lanc ? centavosParaTexto(lanc.valorCentavos) : ''}" required>
    </label>
    <p class="erro" id="erro-valor" hidden>Informe um valor maior que zero.</p>

    <div class="so-normal">
      <label class="campo"><span>Carteira</span>
        <select name="carteiraId">${opcoesCarteira(estado, carteiraId)}</select></label>
      <fieldset class="campo"><legend>Categoria</legend>
        <div class="chips" id="chips-cat">${tipo === 'transferencia' ? '' : chipsCategorias(estado, carteiraId, tipo, lanc?.categoriaId)}</div>
        <p class="erro" id="erro-cat" hidden>Escolha uma categoria.</p>
      </fieldset>
    </div>
    <div class="so-transf linha">
      <label class="campo"><span>De</span><select name="de">${opcoesCarteira(estado, de)}</select></label>
      <label class="campo"><span>Para</span><select name="para">${opcoesCarteira(estado, para)}</select></label>
    </div>
    <p class="erro" id="erro-transf" hidden>Escolha carteiras diferentes.</p>

    <div class="linha">
      <label class="campo"><span>Data</span><input type="date" name="data" value="${esc(data)}" required></label>
      <label class="campo check"><input type="checkbox" name="pago" ${pago ? 'checked' : ''}><span>Já foi pago</span></label>
    </div>
    <label class="campo"><span>Descrição (opcional)</span>
      <input name="descricao" maxlength="80" value="${esc(lanc?.descricao && !ehTransf ? lanc.descricao : '')}" placeholder="Ex.: Meta Ads, aluguel, cliente X"></label>
    ${!editando ? `<label class="campo check so-normal"><input type="checkbox" name="repetir"><span>Repetir todo mês neste dia</span></label>` : ''}
    ${lanc?.recorrenciaId ? '<p class="sub">↻ Ocorrência de uma recorrência. Mudanças aqui valem só para este mês; edite a recorrência em Ajustes.</p>' : ''}
    <div class="botoes">
      ${editando ? '<button type="button" class="perigo" data-acao="excluir-lanc">Excluir</button>' : ''}
      <button type="submit" class="primario">Salvar</button>
    </div>
  </form>`;
}

export function formRecorrencia(estado, rec) {
  return `
  <form id="form-rec" class="folha-form" data-id="${esc(rec.id)}" novalidate>
    <header class="folha-topo">
      <h2>Editar recorrência</h2>
      <button type="button" class="icone" data-acao="fechar" aria-label="Fechar">✕</button>
    </header>
    <div class="seg">
      <label class="seg-op saida"><input type="radio" name="tipo" value="saida" ${rec.tipo === 'saida' ? 'checked' : ''}><span>Saída</span></label>
      <label class="seg-op entrada"><input type="radio" name="tipo" value="entrada" ${rec.tipo === 'entrada' ? 'checked' : ''}><span>Entrada</span></label>
    </div>
    <label class="campo-valor"><span>R$</span>
      <input name="valor" inputmode="decimal" value="${centavosParaTexto(rec.valorCentavos)}" required></label>
    <p class="erro" id="erro-valor" hidden>Informe um valor maior que zero.</p>
    <label class="campo"><span>Carteira</span><select name="carteiraId">${opcoesCarteira(estado, rec.carteiraId)}</select></label>
    <fieldset class="campo"><legend>Categoria</legend>
      <div class="chips" id="chips-cat">${chipsCategorias(estado, rec.carteiraId, rec.tipo, rec.categoriaId)}</div>
      <p class="erro" id="erro-cat" hidden>Escolha uma categoria.</p>
    </fieldset>
    <div class="linha">
      <label class="campo"><span>Dia do mês</span><input type="number" name="diaDoMes" min="1" max="31" value="${rec.diaDoMes}" required></label>
      <label class="campo"><span>Termina em (opcional)</span><input type="date" name="fim" value="${esc(rec.fim ?? '')}"></label>
    </div>
    <label class="campo"><span>Descrição</span><input name="descricao" maxlength="80" value="${esc(rec.descricao ?? '')}"></label>
    <label class="campo check"><input type="checkbox" name="ativa" ${rec.ativa ? 'checked' : ''}><span>Ativa (gera lançamentos todo mês)</span></label>
    <p class="sub">As mudanças valem para as próximas ocorrências ainda não pagas. O que já foi pago não muda.</p>
    <div class="botoes">
      <button type="button" class="perigo" data-acao="excluir-recorrencia">Excluir recorrência</button>
      <button type="submit" class="primario">Salvar</button>
    </div>
  </form>`;
}
