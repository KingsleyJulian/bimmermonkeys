<script setup lang="ts">
import { resolvedTheme, toggleTheme } from '@/lib/theme';
defineProps<{ wide?: boolean }>();
</script>

<template>
  <button type="button" class="btn sm ghost theme-toggle" :title="resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme">
    <span>{{ resolvedTheme === 'dark' ? '☀' : '☾' }}</span>
    <span v-if="wide">{{ resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode' }}</span>
  </button>
</template>

<style scoped>
.theme-toggle { color: var(--text-muted); }
.theme-toggle span:first-child { font-size: 15px; line-height: 1; }
</style>
