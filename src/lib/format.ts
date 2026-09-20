export const fmtDate = (iso: string | null | undefined, withTime = true) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: '2-digit', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).toUpperCase();
};
export const fmtMoney = (n: number | string | null | undefined) =>
  n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtInt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('en-PH'));
export { isFinished, statusLabel, statusTone } from './status';
export const up = (s: string) => s.toUpperCase();
