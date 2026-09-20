<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/stores/auth';
import { toast } from '@/lib/toast';
import ThemeToggle from '@/components/ThemeToggle.vue';

const auth = useAuth();
const router = useRouter();
const email = ref('');
const password = ref('');
const busy = ref(false);

async function submit() {
  busy.value = true;
  try {
    await auth.signIn(email.value, password.value);
    if (!auth.isAdmin) {
      await auth.signOut();
      throw new Error('This account is not an admin');
    }
    router.push('/dashboard');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Sign-in failed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="login">
    <form class="card" @submit.prevent="submit">
      <div class="brand" style="padding-left: 0">
        <img src="/logo.png" alt="" />
        <div><b>BIMMERMONKEYS</b><small>Admin console</small></div>
      </div>
      <div class="field mt">
        <label>Email</label>
        <input v-model="email" class="input lower" type="email" autocomplete="email" required />
      </div>
      <div class="field mt">
        <label>Password</label>
        <input v-model="password" class="input lower" type="password" autocomplete="current-password" required />
      </div>
      <button class="btn primary mt" style="width: 100%" :disabled="busy">Sign in</button>
      <p class="help mt">ADMIN ACCOUNTS ONLY. TECHNICIANS USE THE MOBILE APP.</p>
      <div class="row between mt"><router-link class="btn sm ghost" to="/">‹ Customer portal</router-link><ThemeToggle wide /></div>
    </form>
  </div>
</template>
