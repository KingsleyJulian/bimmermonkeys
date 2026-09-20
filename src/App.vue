<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '@/stores/auth';
import { toasts } from '@/lib/toast';
import ThemeToggle from '@/components/ThemeToggle.vue';
import { isConfigured } from '@/lib/supabase';

const auth = useAuth();
const route = useRoute();
const router = useRouter();

const nav = [
  { to: '/dashboard', label: 'Dashboard', ico: '▦' },
  { to: '/job-orders', label: 'Job Orders', ico: '≡' },
  { to: '/vehicles', label: 'Vehicles', ico: '⌂' },
  { to: '/inventory', label: 'Inventory', ico: '▣' },
  { to: '/charges', label: 'Charges', ico: '₱' },
  { to: '/audit', label: 'Audit Trail', ico: '✎' },
  { to: '/technicians', label: 'Technicians', ico: '☺' },
  { to: '/settings', label: 'Settings', ico: '⚙' },
];

async function signOut() {
  await auth.signOut();
  router.push('/login');
}
</script>

<template>
  <div v-if="!isConfigured" class="login">
    <div class="card" style="text-transform: none">
      <h2>Console not configured</h2>
      <p style="color: var(--text-muted)">This build has no Supabase settings. Set these environment variables on the host (e.g. Vercel → Project → Settings → Environment Variables) and redeploy:</p>
      <pre class="card" style="padding: 12px; font-size: 12px; overflow: auto">VITE_SUPABASE_URL=https://&lt;project-ref&gt;.supabase.co
VITE_SUPABASE_KEY=sb_publishable_...</pre>
      <p class="help">Vite bakes these in at build time, so they must exist before the build runs.</p>
    </div>
  </div>
  <div v-else-if="route.meta.public || route.meta.print || !auth.isAdmin">
    <router-view />
  </div>
  <div v-else class="shell">
    <aside class="sidebar">
      <div class="brand">
        <img src="/logo.png" alt="" />
        <div>
          <b>BIMMERMONKEYS</b>
          <small>Admin console</small>
        </div>
      </div>
      <nav class="nav">
        <router-link v-for="n in nav" :key="n.to" :to="n.to"><span class="ico">{{ n.ico }}</span>{{ n.label }}</router-link>
      </nav>
      <div class="spacer" />
      <div class="me">
        <b>{{ auth.profile?.display_name }}</b>
        <span>{{ auth.email }}</span>
        <div class="mt row" style="gap: 4px"><button class="btn sm ghost" @click="signOut">Sign out</button><ThemeToggle wide /></div>
      </div>
    </aside>
    <main class="main">
      <router-view />
    </main>
  </div>
  <div class="toasts">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="t.kind">{{ t.message }}</div>
  </div>
</template>
