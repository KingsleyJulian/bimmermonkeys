import { reactive } from 'vue';

type Toast = { id: number; kind: 'success' | 'error' | 'info'; message: string };
export const toasts = reactive<Toast[]>([]);
let seq = 0;
function push(kind: Toast['kind'], message: string) {
  const id = ++seq;
  toasts.push({ id, kind, message });
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id);
    if (i >= 0) toasts.splice(i, 1);
  }, 3500);
}
export const toast = {
  success: (m: string) => push('success', m),
  error: (m: string) => push('error', m),
  info: (m: string) => push('info', m),
};
