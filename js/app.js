import * as db from './db.js';
import * as telas from './telas.js';
import { TUDO, parseValor } from './calc.js';
import { hojeISO, competenciaDe, addMeses } from './datas.js';
import { gerarPendentes, propagarEdicao, marcarPulada } from './recorrencia.js';
import { criarTransferencia, parDaTransferencia } from './transferencia.js';
import { formLancamento, formRecorrencia, chipsCategorias } from './form.js';
import { esc } from './ui.js';
import { uid } from './uid.js';

const hoje = hojeISO();
const estado = {
  carteiras: [], categorias: [], lancamentos: [], recorrencias: [],
  carteira: TUDO, tela: 'inicio', hoje, mes: competenciaDe(hoje),
  filtro: { tipo: 'todos', categoriaId: '' }, tipoGrafico: 'saida',
  ultimoBackup: null, ultimaCarteira: null, ultimoTipo: null,
};

const $ = (s) => document.querySelector(s);
const main = $('#conteudo');
const folha = $('#folha');

// ---------- preferências locais (conveniência; falha silenciosamente) ----------
function lerPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem('caixa-prefs') || '{}');
    Object.assign(estado, {
      carteira: p.carteira ?? TUDO, ultimaCarteira: p.ultimaCarteira ?? null, ultimoTipo: p.ultimoTipo ?? null,
    });
  } catch { /* sem storage */ }
}
function gravarPrefs() {
  try {
    localStorage.setItem('caixa-prefs', JSON.stringify({
      carteira: estado.carteira, ultimaCarteira: estado.ultimaCarteira, ultimoTipo: estado.ultimoTipo,
    }));
  } catch { /* sem storage */ }
}

// ---------- dados ----------
async function carregar() {
  for (const s of ['carteiras', 'categorias', 'lancamentos', 'recorrencias']) estado[s] = await db.todos(s);
  estado.ultimoBackup = (await db.lerMeta('ultimoBackup')) ?? null;
  if (estado.carteira !== TUDO && !estado.carteiras.some((c) => c.id === estado.carteira)) estado.carteira = TUDO;
}

async function rodarRecorrencias() {
  const novos = gerarPendentes(estado.recorrencias, estado.lancamentos, estado.hoje);
  if (!novos.length) return;
  await db.salvar('lancamentos', ...novos);
  estado.lancamentos.push(...novos);
}

async function gravarLancamentos(...ls) {
  await db.salvar('lancamentos', ...ls);
  for (const l of ls) {
    const i = estado.lancamentos.findIndex((x) => x.id === l.id);
    if (i >= 0) estado.lancamentos[i] = l; else estado.lancamentos.push(l);
  }
}

async function apagarLancamentos(...ids) {
  await db.excluir('lancamentos', ...ids);
  estado.lancamentos = estado.lancamentos.filter((l) => !ids.includes(l.id));
}

async function gravarRecorrencia(rec) {
  await db.salvar('recorrencias', rec);
  const i = estado.recorrencias.findIndex((r) => r.id === rec.id);
  if (i >= 0) estado.recorrencias[i] = rec; else estado.recorrencias.push(rec);
}

// ---------- render ----------
function render() {
  $('#carteiras').innerHTML = [{ id: TUDO, nome: 'Tudo' }, ...estado.carteiras].map((c) => `
    <button class="chip ${estado.carteira === c.id ? 'ativo' : ''}" data-acao="carteira" data-id="${esc(c.id)}">${esc(c.nome)}</button>`).join('');
  main.innerHTML = telas[estado.tela](estado);
  document.querySelectorAll('nav.abas [data-tela]').forEach((b) => {
    b.classList.toggle('ativo', b.dataset.tela === estado.tela);
    b.setAttribute('aria-current', b.dataset.tela === estado.tela ? 'page' : 'false');
  });
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

// ---------- folha (dialog) ----------
function abrirFolha(html) {
  folha.innerHTML = html;
  folha.showModal();
  const form = folha.querySelector('form');
  if (form.id === 'form-lanc') prepararFormLanc(form);
  if (form.id === 'form-rec') prepararFormRec(form);
}
function fecharFolha() { if (folha.open) folha.close(); }

folha.addEventListener('click', (e) => { if (e.target === folha) fecharFolha(); });

function modoDoForm(form) {
  form.dataset.modo = form.querySelector('[name=tipo]:checked')?.value ?? 'saida';
}

function recarregarChips(form) {
  const tipo = form.querySelector('[name=tipo]:checked').value;
  if (tipo === 'transferencia') return;
  const carteiraId = form.carteiraId.value;
  const atual = form.querySelector('[name=categoriaId]:checked')?.value;
  form.querySelector('#chips-cat').innerHTML = chipsCategorias(estado, carteiraId, tipo, atual);
}

function prepararFormLanc(form) {
  modoDoForm(form);
  let pagoTocado = !!form.dataset.id;
  form.addEventListener('change', (e) => {
    const n = e.target.name;
    if (n === 'tipo' || n === 'carteiraId') { modoDoForm(form); recarregarChips(form); }
    if (n === 'pago') pagoTocado = true;
    if (n === 'data' && !pagoTocado) form.pago.checked = form.data.value <= estado.hoje;
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); salvarLanc(form); });
}

function prepararFormRec(form) {
  form.addEventListener('change', (e) => {
    if (e.target.name === 'tipo' || e.target.name === 'carteiraId') {
      const tipo = form.querySelector('[name=tipo]:checked').value;
      form.querySelector('#chips-cat').innerHTML = chipsCategorias(estado, form.carteiraId.value, tipo, null);
    }
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); salvarRec(form); });
}

function erro(form, id, mostrar) {
  form.querySelector(id).hidden = !mostrar;
  return mostrar;
}

async function salvarLanc(form) {
  const fd = new FormData(form);
  const valorCentavos = parseValor(fd.get('valor'));
  const tipo = fd.get('tipo');
  const data = fd.get('data') || estado.hoje;
  const status = fd.get('pago') ? 'pago' : 'pendente';
  const descricao = String(fd.get('descricao') || '').trim();
  const existente = form.dataset.id ? estado.lancamentos.find((l) => l.id === form.dataset.id) : null;
  const pagoEm = (l) => (status === 'pago' ? (l?.pagoEm ?? estado.hoje) : null);

  let falhou = erro(form, '#erro-valor', !valorCentavos);

  if (tipo === 'transferencia') {
    const de = fd.get('de'); const para = fd.get('para');
    falhou = erro(form, '#erro-transf', de === para) || falhou;
    if (falhou) return;
    const nomes = Object.fromEntries(estado.carteiras.map((c) => [c.id, c.nome]));
    if (existente) {
      const par = parDaTransferencia(estado.lancamentos, existente.transferenciaId);
      const atualizados = par.map((l) => ({
        ...l, valorCentavos, data, status, pagoEm: pagoEm(l),
        carteiraId: l.tipo === 'saida' ? de : para,
        descricao: descricao || (l.tipo === 'saida' ? `Transferência → ${nomes[para]}` : `Transferência ← ${nomes[de]}`),
      }));
      await gravarLancamentos(...atualizados);
    } else {
      const novos = criarTransferencia({ deCarteiraId: de, paraCarteiraId: para, valorCentavos, data, status, descricao, nomes })
        .map((l) => ({ ...l, criadoEm: new Date().toISOString(), pagoEm: pagoEm() }));
      await gravarLancamentos(...novos);
    }
  } else {
    const categoriaId = fd.get('categoriaId');
    const carteiraId = fd.get('carteiraId');
    falhou = erro(form, '#erro-cat', !categoriaId) || falhou;
    if (falhou) return;
    if (existente) {
      await gravarLancamentos({ ...existente, tipo, valorCentavos, carteiraId, categoriaId, data, status, descricao, pagoEm: pagoEm(existente) });
    } else {
      const l = {
        id: uid(), tipo, valorCentavos, carteiraId, categoriaId, data, status, descricao,
        pagoEm: pagoEm(), criadoEm: new Date().toISOString(),
      };
      if (fd.get('repetir')) {
        const rec = {
          id: uid(), carteiraId, tipo, valorCentavos, categoriaId, descricao,
          diaDoMes: Number(data.slice(8, 10)), inicio: data, ativa: true, puladas: [],
        };
        l.recorrenciaId = rec.id;
        l.competencia = competenciaDe(data);
        await gravarRecorrencia(rec);
      }
      await gravarLancamentos(l);
      await rodarRecorrencias();
    }
    estado.ultimaCarteira = carteiraId;
  }
  estado.ultimoTipo = tipo;
  gravarPrefs();
  fecharFolha();
  render();
  toast(existente ? 'Alterado' : 'Lançado');
}

async function salvarRec(form) {
  const fd = new FormData(form);
  const rec = estado.recorrencias.find((r) => r.id === form.dataset.id);
  const valorCentavos = parseValor(fd.get('valor'));
  const categoriaId = fd.get('categoriaId');
  let falhou = erro(form, '#erro-valor', !valorCentavos);
  falhou = erro(form, '#erro-cat', !categoriaId) || falhou;
  const dia = Math.min(31, Math.max(1, Number(fd.get('diaDoMes')) || rec.diaDoMes));
  if (falhou) return;
  const novo = {
    ...rec, tipo: fd.get('tipo'), valorCentavos, categoriaId, carteiraId: fd.get('carteiraId'),
    diaDoMes: dia, fim: fd.get('fim') || null, descricao: String(fd.get('descricao') || '').trim(),
    ativa: !!fd.get('ativa'),
  };
  await gravarRecorrencia(novo);
  const alterados = propagarEdicao(novo, estado.lancamentos, estado.hoje);
  if (alterados.length) await gravarLancamentos(...alterados);
  // Pausada ou com fim: remove pendentes futuros que não deveriam mais existir.
  const sobrando = estado.lancamentos.filter((l) => l.recorrenciaId === novo.id && l.status === 'pendente'
    && l.data >= estado.hoje && (!novo.ativa || (novo.fim && l.data > novo.fim)));
  if (sobrando.length) await apagarLancamentos(...sobrando.map((l) => l.id));
  await rodarRecorrencias();
  fecharFolha();
  render();
  toast('Recorrência salva');
}

// ---------- ações (delegação de clique) ----------
const acoes = {
  tela(el) { estado.tela = el.dataset.tela; render(); window.scrollTo(0, 0); },
  carteira(el) { estado.carteira = el.dataset.id; estado.filtro.categoriaId = ''; gravarPrefs(); render(); },
  mes(el) { estado.mes = addMeses(estado.mes, Number(el.dataset.delta)); render(); },
  'filtro-tipo'(el) { estado.filtro.tipo = el.dataset.v; render(); },
  'tipo-grafico'(el) { estado.tipoGrafico = el.dataset.v; render(); },
  novo() {
    abrirFolha(formLancamento({ ...estado, ultimaCarteira: estado.carteira !== TUDO ? estado.carteira : estado.ultimaCarteira }, null));
  },
  editar(el) {
    const l = estado.lancamentos.find((x) => x.id === el.dataset.id);
    if (!l) return;
    const par = l.transferenciaId ? parDaTransferencia(estado.lancamentos, l.transferenciaId).find((x) => x.id !== l.id) : null;
    abrirFolha(formLancamento(estado, l, par));
  },
  fechar: fecharFolha,
  async pagar(el) {
    const l = estado.lancamentos.find((x) => x.id === el.dataset.id);
    if (!l) return;
    const alvo = l.transferenciaId ? parDaTransferencia(estado.lancamentos, l.transferenciaId) : [l];
    await gravarLancamentos(...alvo.map((x) => ({ ...x, status: 'pago', pagoEm: estado.hoje })));
    render();
    toast(l.tipo === 'entrada' ? 'Marcado como recebido' : 'Marcado como pago');
  },
  async 'excluir-lanc'() {
    const form = folha.querySelector('#form-lanc');
    const l = estado.lancamentos.find((x) => x.id === form.dataset.id);
    if (!l || !confirm('Excluir este lançamento?')) return;
    if (l.recorrenciaId) {
      const rec = estado.recorrencias.find((r) => r.id === l.recorrenciaId);
      if (rec) await gravarRecorrencia(marcarPulada(rec, l.competencia));
    }
    const ids = l.transferenciaId ? parDaTransferencia(estado.lancamentos, l.transferenciaId).map((x) => x.id) : [l.id];
    await apagarLancamentos(...ids);
    fecharFolha(); render(); toast('Excluído');
  },
  'editar-recorrencia'(el) {
    const rec = estado.recorrencias.find((r) => r.id === el.dataset.id);
    if (rec) abrirFolha(formRecorrencia(estado, rec));
  },
  async 'excluir-recorrencia'() {
    const form = folha.querySelector('#form-rec');
    const rec = estado.recorrencias.find((r) => r.id === form.dataset.id);
    if (!rec || !confirm('Excluir a recorrência? O que já foi pago fica no extrato; os pendentes a partir de hoje serão apagados.')) return;
    const pend = estado.lancamentos.filter((l) => l.recorrenciaId === rec.id && l.status === 'pendente' && l.data >= estado.hoje);
    if (pend.length) await apagarLancamentos(...pend.map((l) => l.id));
    await db.excluir('recorrencias', rec.id);
    estado.recorrencias = estado.recorrencias.filter((r) => r.id !== rec.id);
    fecharFolha(); render(); toast('Recorrência excluída');
  },
  async 'nova-categoria'(el) {
    const nome = (prompt('Nome da nova categoria:') || '').trim();
    if (!nome) return;
    const { carteira, tipo } = el.dataset;
    const n = estado.categorias.filter((c) => c.carteiraId === carteira).length;
    const cat = { id: uid(), carteiraId: carteira, tipo, nome, cor: db.PALETA[n % db.PALETA.length] };
    await db.salvar('categorias', cat);
    estado.categorias.push(cat);
    render();
  },
  async 'excluir-categoria'(el) {
    const id = el.dataset.id;
    const emUso = estado.lancamentos.some((l) => l.categoriaId === id) || estado.recorrencias.some((r) => r.categoriaId === id);
    if (emUso) { alert('Esta categoria tem lançamentos ou recorrências. Mova-os para outra categoria antes de excluir.'); return; }
    const cat = estado.categorias.find((c) => c.id === id);
    if (!confirm(`Excluir a categoria "${cat?.nome}"?`)) return;
    await db.excluir('categorias', id);
    estado.categorias = estado.categorias.filter((c) => c.id !== id);
    render();
  },
  async exportar() {
    const dump = await db.exportarTudo();
    const blob = new Blob([JSON.stringify(dump, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `caixa-backup-${hojeISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    estado.ultimoBackup = new Date().toISOString();
    await db.gravarMeta('ultimoBackup', estado.ultimoBackup);
    render();
    toast('Backup baixado');
  },
  importar() { $('#arquivo-backup')?.click(); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-acao]');
  if (!el || el.tagName === 'SELECT') return;
  const fn = acoes[el.dataset.acao];
  if (fn) { e.preventDefault(); fn(el, e); }
});

document.addEventListener('change', async (e) => {
  if (e.target.matches('[data-acao=filtro-categoria]')) {
    estado.filtro.categoriaId = e.target.value;
    render();
  }
  if (e.target.id === 'arquivo-backup') {
    const arq = e.target.files?.[0];
    if (!arq) return;
    try {
      const dump = JSON.parse(await arq.text());
      const n = dump?.lancamentos?.length ?? 0;
      if (!confirm(`Restaurar backup com ${n} lançamentos? Isso SUBSTITUI todos os dados atuais deste aparelho.`)) return;
      await db.importarTudo(dump);
      await carregar();
      await rodarRecorrencias();
      render();
      toast('Backup restaurado');
    } catch (err) {
      alert(`Não foi possível restaurar: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  }
});

// Se o app ficar aberto de um dia para o outro, atualiza "hoje" e gera recorrências.
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;
  const h = hojeISO();
  if (h === estado.hoje) return;
  estado.hoje = h;
  await rodarRecorrencias();
  render();
});

// ---------- inicialização ----------
async function iniciar() {
  lerPrefs();
  try {
    await db.abrir();
    await db.semearSeVazio();
    await carregar();
    await rodarRecorrencias();
    render();
  } catch (err) {
    main.innerHTML = `<p class="vazio">Não foi possível abrir o banco de dados local: ${esc(err.message)}</p>`;
    console.error(err);
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
  }
}

// exposto só para depuração no console
window.__caixa = { estado };
iniciar();
