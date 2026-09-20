<script setup lang="ts">
import HelpButton from '@/components/HelpButton.vue';
import { onMounted, ref } from 'vue';
import Modal from '@/components/Modal.vue';
import TechnicianActivity from '@/components/TechnicianActivity.vue';
import { adminUsers } from '@/lib/supabase';
import { fmtDate } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useAuth } from '@/stores/auth';

type User = { id: string; display_name: string; role: 'tech' | 'admin'; is_active: boolean; email: string | null; last_sign_in_at: string | null; created_at: string };

const auth = useAuth();
const users = ref<User[]>([]);
const loading = ref(false);
const editing = ref<Partial<User> & { password?: string } | null>(null);
const resetting = ref<User | null>(null);
const viewing = ref<User | null>(null);
const newPassword = ref('');
const busy = ref(false);

async function load() {
  loading.value = true;
  try {
    const r = await adminUsers<{ users: User[] }>({ action: 'list' });
    users.value = r.users;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not load users');
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function startCreate() {
  editing.value = { display_name: '', email: '', role: 'tech', is_active: true, password: '' };
}
function startEdit(u: User) {
  editing.value = { ...u };
}

async function save() {
  if (!editing.value) return;
  const e = editing.value;
  busy.value = true;
  try {
    if (!e.id) {
      if (!e.email || !e.password || !e.display_name) throw new Error('Email, password and name are required');
      if (e.password.length < 8) throw new Error('Password must be at least 8 characters');
      await adminUsers({ action: 'create', email: e.email, password: e.password, display_name: e.display_name, role: e.role });
      toast.success('Technician created');
    } else {
      await adminUsers({ action: 'update', id: e.id, display_name: e.display_name, role: e.role, is_active: e.is_active, email: e.email });
      toast.success('Saved');
    }
    editing.value = null;
    load();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed');
  } finally {
    busy.value = false;
  }
}

async function toggleActive(u: User) {
  try {
    await adminUsers({ action: 'update', id: u.id, is_active: !u.is_active });
    toast.success(u.is_active ? `${u.display_name} deactivated` : `${u.display_name} reactivated`);
    load();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed');
  }
}

async function resetPassword() {
  if (!resetting.value) return;
  busy.value = true;
  try {
    await adminUsers({ action: 'reset_password', id: resetting.value.id, password: newPassword.value });
    toast.success('Password updated');
    resetting.value = null;
    newPassword.value = '';
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed');
  } finally {
    busy.value = false;
  }
}

async function remove(u: User) {
  if (!confirm(`Delete ${u.display_name}? Their name stays on past job orders and reports, but they can no longer sign in.`)) return;
  try {
    await adminUsers({ action: 'delete', id: u.id });
    toast.success('Deleted');
    load();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed');
  }
}
</script>

<template>
  <div class="page-head">
    <div class="row"><HelpButton topic="technicians" /><div><h1>Technicians</h1><p>Accounts for the mobile app and this console</p></div></div>
    <button class="btn primary" @click="startCreate">+ New account</button>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Created</th><th></th></tr></thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td><a href="#" style="font-weight: 700" @click.prevent="viewing = u">{{ u.display_name }}</a><span v-if="u.id === auth.profile?.id" class="badge info" style="margin-left: 8px">You</span></td>
          <td style="text-transform: none">{{ u.email ?? '—' }}</td>
          <td><span class="badge" :class="u.role === 'admin' ? 'info' : ''">{{ u.role }}</span></td>
          <td><span class="badge" :class="u.is_active ? 'ok' : 'danger'">{{ u.is_active ? 'Active' : 'Inactive' }}</span></td>
          <td>{{ fmtDate(u.last_sign_in_at) }}</td>
          <td>{{ fmtDate(u.created_at, false) }}</td>
          <td>
            <div class="row end">
              <button class="btn sm primary" @click="viewing = u">Activity</button>
              <button class="btn sm" @click="startEdit(u)">Edit</button>
              <button class="btn sm" @click="resetting = u">Password</button>
              <button class="btn sm" :disabled="u.id === auth.profile?.id" @click="toggleActive(u)">{{ u.is_active ? 'Deactivate' : 'Reactivate' }}</button>
              <button class="btn sm danger" :disabled="u.id === auth.profile?.id" @click="remove(u)">Delete</button>
            </div>
          </td>
        </tr>
        <tr v-if="!users.length && !loading"><td colspan="7" class="empty">No accounts</td></tr>
      </tbody>
    </table>
  </div>

  <Modal v-if="editing" :title="editing.id ? 'Edit account' : 'New account'" help="technician-modal" @close="editing = null">
    <form class="grid cols-2" @submit.prevent="save">
      <div class="field">
        <label>Display name <span class="req">*</span></label>
        <input v-model="editing.display_name" class="input" required @input="editing.display_name = (editing.display_name ?? '').toUpperCase()" />
        <span class="help">Printed on every photo, video and report this person captures.</span>
      </div>
      <div class="field">
        <label>Email <span class="req">*</span></label>
        <input v-model="editing.email" class="input lower" type="email" required />
      </div>
      <div v-if="!editing.id" class="field">
        <label>Password <span class="req">*</span></label>
        <input v-model="editing.password" class="input lower" type="text" minlength="8" required />
        <span class="help">At least 8 characters. Share it with the technician; they cannot self-register.</span>
      </div>
      <div class="field">
        <label>Role</label>
        <select v-model="editing.role" class="input">
          <option value="tech">Technician (mobile app)</option>
          <option value="admin">Admin (mobile app + console)</option>
        </select>
      </div>
      <div v-if="editing.id" class="field">
        <label>Status</label>
        <select v-model="editing.is_active" class="input">
          <option :value="true">Active</option>
          <option :value="false">Inactive (cannot sign in)</option>
        </select>
      </div>
      <div class="row end" style="grid-column: 1 / -1">
        <button type="button" class="btn ghost" @click="editing = null">Cancel</button>
        <button class="btn primary" :disabled="busy">{{ editing.id ? 'Save' : 'Create' }}</button>
      </div>
    </form>
  </Modal>

 <TechnicianActivity v-if="viewing" :user-id="viewing.id" :name="viewing.display_name" @close="viewing = null" />

  <Modal v-if="resetting" :title="`Reset password · ${resetting.display_name}`" @close="resetting = null">
    <form @submit.prevent="resetPassword">
      <div class="field">
        <label>New password</label>
        <input v-model="newPassword" class="input lower" type="text" minlength="8" required />
      </div>
      <div class="row end mt">
        <button type="button" class="btn ghost" @click="resetting = null">Cancel</button>
        <button class="btn primary" :disabled="busy">Update password</button>
      </div>
    </form>
  </Modal>
</template>
