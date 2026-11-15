// Wrapper mínimo de IndexedDB. Todos os dados cabem em memória; escrevemos item a item.
import { uid } from './uid.js';

const NOME = 'caixa';
const VERSAO = 1;
export const STORES = ['carteiras', 'categorias', 'lancamentos', 'recorrencias', 'meta'];

let db;

function req(r) {
  return new Promise((ok, erro) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}

function tx(stores, modo, fn) {
  return new Promise((ok, erro) => {
    const t = db.transaction(stores, modo);
    const resultado = fn(t);
    t.oncomplete = () => ok(resultado);
    t.onerror = () => erro(t.error);
    t.onabort = () => erro(t.error);
  });
}

export async function abrir() {
  const r = indexedDB.open(NOME, VERSAO);
  r.onupgradeneeded = () => {
    const d = r.result;
    for (const s of STORES) {
      if (!d.objectStoreNames.contains(s)) {
        d.createObjectStore(s, { keyPath: s === 'meta' ? 'chave' : 'id' });
      }
    }
  };
  db = await req(r);
  // Pede ao navegador para não apagar os dados sob pressão de espaço.
  try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
  return db;
}

export async function todos(store) {
  return req(db.transaction(store).objectStore(store).getAll());
}

export function salvar(store, ...objs) {
  return tx([store], 'readwrite', (t) => {
    const s = t.objectStore(store);
    for (const o of objs) s.put(o);
  });
}

export function excluir(store, ...ids) {
  return tx([store], 'readwrite', (t) => {
    const s = t.objectStore(store);
    for (const id of ids) s.delete(id);
  });
}

export async function lerMeta(chave) {
  const r = await req(db.transaction('meta').objectStore('meta').get(chave));
  return r?.valor;
}

export function gravarMeta(chave, valor) {
  return salvar('meta', { chave, valor });
}

export async function exportarTudo() {
  const dump = { app: 'caixa', versaoSchema: VERSAO, exportadoEm: new Date().toISOString() };
  for (const s of STORES) dump[s] = await todos(s);
  return dump;
}

// Substitui todo o conteúdo pelo dump (restauração de backup).
export function importarTudo(dump) {
  if (dump?.app !== 'caixa' || !Array.isArray(dump.lancamentos)) {
    throw new Error('Arquivo não é um backup do Caixa.');
  }
  return tx(STORES, 'readwrite', (t) => {
    for (const s of STORES) {
      const st = t.objectStore(s);
      st.clear();
      for (const o of dump[s] ?? []) st.put(o);
    }
  });
}

const CATEGORIAS_INICIAIS = {
  Pessoal: {
    entrada: ['Salário / Pró-labore', 'Outras entradas'],
    saida: ['Moradia', 'Mercado', 'Transporte', 'Saúde', 'Lazer', 'Assinaturas', 'Outros'],
  },
  Negócio: {
    entrada: ['Vendas', 'Serviços', 'Outras entradas'],
    saida: ['Ads', 'Ferramentas', 'Fornecedores', 'Impostos', 'Equipe', 'Outros'],
  },
};

export const PALETA = ['#2f6fdf', '#e0702c', '#2a9d6f', '#c24a7a', '#8a5cd6', '#c79a1c',
  '#3a9fb8', '#d0503c', '#5f7f2e', '#7a6a58', '#4a5bbf', '#b8569b'];

export async function semearSeVazio() {
  if ((await todos('carteiras')).length) return false;
  const carteiras = [];
  const categorias = [];
  for (const nome of Object.keys(CATEGORIAS_INICIAIS)) {
    const c = { id: uid(), nome };
    carteiras.push(c);
    let i = 0;
    for (const tipo of ['entrada', 'saida']) {
      for (const n of CATEGORIAS_INICIAIS[nome][tipo]) {
        categorias.push({ id: uid(), carteiraId: c.id, nome: n, tipo, cor: PALETA[i++ % PALETA.length] });
      }
    }
  }
  await salvar('carteiras', ...carteiras);
  await salvar('categorias', ...categorias);
  return true;
}
