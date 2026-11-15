// Datas como strings 'AAAA-MM-DD' e competências como 'AAAA-MM'.
// Comparação lexicográfica funciona para ambos.

const pad = (n) => String(n).padStart(2, '0');

export function hojeISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function competenciaDe(dataISO) {
  return dataISO.slice(0, 7);
}

export function ultimoDiaDoMes(ano, mes) {
  // mes 1..12
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function addMeses(competencia, n) {
  const [a, m] = competencia.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

export function addDias(dataISO, n) {
  const [a, m, d] = dataISO.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// Dia do mês limitado ao último dia (31 em fevereiro -> 28/29).
export function dataNaCompetencia(competencia, diaDoMes) {
  const [a, m] = competencia.split('-').map(Number);
  const dia = Math.min(diaDoMes, ultimoDiaDoMes(a, m));
  return `${competencia}-${pad(dia)}`;
}

export function fimDoMes(competencia) {
  return dataNaCompetencia(competencia, 31);
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
  'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function rotuloMesCurto(competencia) {
  const [a, m] = competencia.split('-').map(Number);
  return `${MESES[m - 1]}/${String(a).slice(2)}`;
}

export function rotuloMesLongo(competencia) {
  const [a, m] = competencia.split('-').map(Number);
  return `${MESES_LONGOS[m - 1]} ${a}`;
}

export function rotuloData(dataISO) {
  const [, m, d] = dataISO.split('-').map(Number);
  return `${pad(d)}/${pad(m)}`;
}
