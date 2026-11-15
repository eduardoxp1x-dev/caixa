// Gráficos em SVG puro, sem dependências.
import { esc } from './ui.js';
import { formatarBRL } from './calc.js';
import { rotuloMesCurto } from './datas.js';

export function rosca(fatias, { rotuloCentro = '', valorCentro = '' } = {}) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const r = 60;
  const C = 2 * Math.PI * r;
  let acumulado = 0;
  const arcos = total === 0
    ? `<circle cx="80" cy="80" r="${r}" fill="none" stroke="var(--borda)" stroke-width="22"/>`
    : fatias.map((f) => {
      const len = (f.valor / total) * C;
      const arco = `<circle cx="80" cy="80" r="${r}" fill="none" stroke="${esc(f.cor)}" stroke-width="22"
        stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-acumulado).toFixed(2)}"
        transform="rotate(-90 80 80)"><title>${esc(f.nome)}: ${esc(formatarBRL(f.valor))}</title></circle>`;
      acumulado += len;
      return arco;
    }).join('');
  return `<svg viewBox="0 0 160 160" class="rosca" role="img" aria-label="${esc(rotuloCentro)} ${esc(valorCentro)}">
    ${arcos}
    <text x="80" y="74" text-anchor="middle" class="rosca-rotulo">${esc(rotuloCentro)}</text>
    <text x="80" y="94" text-anchor="middle" class="rosca-valor">${esc(valorCentro)}</text>
  </svg>`;
}

export function barras(serie) {
  const W = 320; const H = 170; const base = 140; const topo = 10;
  const max = Math.max(1, ...serie.flatMap((s) => [s.entradas, s.saidas]));
  const grupo = W / serie.length;
  const bw = Math.min(16, grupo / 3);
  const alt = (v) => ((base - topo) * v) / max;
  const barrasSvg = serie.map((s, i) => {
    const cx = grupo * i + grupo / 2;
    const he = alt(s.entradas); const hs = alt(s.saidas);
    return `
      <rect x="${cx - bw - 1}" y="${base - he}" width="${bw}" height="${he}" rx="3" class="barra-entrada">
        <title>${rotuloMesCurto(s.mes)} entradas: ${esc(formatarBRL(s.entradas))}</title></rect>
      <rect x="${cx + 1}" y="${base - hs}" width="${bw}" height="${hs}" rx="3" class="barra-saida">
        <title>${rotuloMesCurto(s.mes)} saídas: ${esc(formatarBRL(s.saidas))}</title></rect>
      <text x="${cx}" y="${base + 18}" text-anchor="middle" class="eixo">${rotuloMesCurto(s.mes)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="barras" role="img" aria-label="Entradas e saídas por mês">
    <line x1="0" x2="${W}" y1="${base}" y2="${base}" class="linha-base"/>
    ${barrasSvg}
  </svg>`;
}
