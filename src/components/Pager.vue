<script setup lang="ts">
const props = defineProps<{ page: number; pageSize: number; total: number }>();
const emit = defineEmits<{ change: [page: number] }>();
const pages = () => Math.max(1, Math.ceil(props.total / props.pageSize));
</script>

<template>
  <div class="pager">
    <span>
      Showing {{ total ? (page - 1) * pageSize + 1 : 0 }}–{{ Math.min(page * pageSize, total) }} of {{ total.toLocaleString() }} · page {{ page }} / {{ pages() }}
    </span>
    <div class="btns">
      <button class="btn sm" :disabled="page <= 1" @click="emit('change', 1)">«</button>
      <button class="btn sm" :disabled="page <= 1" @click="emit('change', page - 1)">Prev</button>
      <button class="btn sm" :disabled="page >= pages()" @click="emit('change', page + 1)">Next</button>
      <button class="btn sm" :disabled="page >= pages()" @click="emit('change', pages())">»</button>
    </div>
  </div>
</template>
