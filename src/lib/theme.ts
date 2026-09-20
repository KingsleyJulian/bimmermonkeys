import { ref } from 'vue';

/**
 * Light / dark mode for the console and the customer portal. The choice is stored per browser;
 * "auto" follows the OS setting. Tokens live in style.css under [data-theme="light"].
 */
export type ThemeChoice = 'auto' | 'light' | 'dark';
const KEY = 'bm-theme';
const media = window.matchMedia('(prefers-color-scheme: light)');

export const themeChoice = ref<ThemeChoice>(((): ThemeChoice => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
})());
export const resolvedTheme = ref<'light' | 'dark'>('dark');

function apply() {
  resolvedTheme.value = themeChoice.value === 'auto' ? (media.matches ? 'light' : 'dark') : themeChoice.value;
  document.documentElement.dataset.theme = resolvedTheme.value;
}
export function setTheme(choice: ThemeChoice) {
  themeChoice.value = choice;
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* private mode */
  }
  apply();
}
/** Flip between light and dark (leaves "auto" behind on first use). */
export function toggleTheme() {
  setTheme(resolvedTheme.value === 'dark' ? 'light' : 'dark');
}
media.addEventListener('change', () => themeChoice.value === 'auto' && apply());
apply();
