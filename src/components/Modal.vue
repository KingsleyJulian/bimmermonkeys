<script setup lang="ts">
import HelpButton from '@/components/HelpButton.vue';
defineProps<{ title: string; wide?: boolean; help?: string }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <div class="modal-scrim" @click.self="emit('close')">
    <div class="modal" :class="{ wide }">
      <div class="modal-head">
        <div class="row" style="gap: 10px"><h2>{{ title }}</h2><HelpButton v-if="help" :topic="help" small /></div>
        <button class="btn icon ghost" @click="emit('close')">✕</button>
      </div>
      <slot />
    </div>
  </div>
</template>
