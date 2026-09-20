<script setup lang="ts">
import { computed, ref } from 'vue';
import { HELP } from '@/lib/help';

const props = defineProps<{ topic: string; small?: boolean }>();
const open = ref(false);
const help = computed(() => HELP[props.topic]);
</script>

<template>
  <button v-if="help" type="button" class="help-btn" :class="{ small }" :title="`How to use: ${help.title}`" @click.stop="open = true">?</button>
  <Teleport to="body">
    <div v-if="open && help" class="modal-scrim help-scrim" @click.self="open = false">
      <div class="modal help-modal">
        <div class="modal-head">
          <div>
            <span class="badge info">GUIDE</span>
            <h2 style="margin-top: 6px">{{ help.title }}</h2>
          </div>
          <button class="btn icon ghost" @click="open = false">✕</button>
        </div>
        <p class="help-intro">{{ help.intro }}</p>
        <dl class="help-list">
          <template v-for="a in help.actions" :key="a.label">
            <dt>{{ a.label }}</dt>
            <dd>{{ a.text }}</dd>
          </template>
        </dl>
        <ul v-if="help.tips?.length" class="help-tips">
          <li v-for="t in help.tips" :key="t">{{ t }}</li>
        </ul>
        <div class="row end mt"><button class="btn primary" @click="open = false">Got it</button></div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.help-btn {
  width: 28px; height: 28px; border-radius: 999px; border: 1.5px solid var(--m-light-blue); background: transparent;
  color: var(--m-light-blue); font: 700 14px var(--font); cursor: pointer; flex: 0 0 auto; line-height: 1;
}
.help-btn:hover { background: var(--m-light-blue); color: #000; }
.help-btn.small { width: 22px; height: 22px; font-size: 12px; }
.help-scrim { z-index: 200; }
.help-modal { max-width: 640px; max-height: 85vh; overflow: auto; }
.help-intro { color: var(--text-muted); margin: 0 0 14px; }
.help-list { margin: 0; display: grid; grid-template-columns: 170px 1fr; gap: 10px 16px; align-items: start; }
.help-list dt { font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; font-size: 12px; color: var(--m-light-blue); padding-top: 2px; }
.help-list dd { margin: 0; font-size: 13px; line-height: 1.5; text-transform: none; }
.help-tips { margin: 14px 0 0; padding-left: 18px; font-size: 12.5px; color: var(--text-muted); text-transform: none; }
</style>
