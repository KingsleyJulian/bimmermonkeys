import { defineStore } from 'pinia';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Profile = { id: string; display_name: string; role: 'tech' | 'admin'; is_active: boolean };

export const useAuth = defineStore('auth', {
  state: () => ({ session: null as Session | null, profile: null as Profile | null, ready: false }),
  getters: {
    isAdmin: (s) => s.profile?.role === 'admin' && s.profile.is_active,
    email: (s) => s.session?.user.email ?? '',
  },
  actions: {
    async init() {
      const { data } = await supabase.auth.getSession();
      await this.apply(data.session);
      supabase.auth.onAuthStateChange((event, session) => {
        // SIGNED_IN is handled by signIn() itself (awaited); reacting here too would race it.
        if (event === 'SIGNED_IN') return;
        this.apply(session);
      });
      this.ready = true;
    },
    async apply(session: Session | null) {
      this.session = session;
      if (!session) {
        this.profile = null;
        return;
      }
      const { data } = await supabase.from('profiles').select('id, display_name, role, is_active').eq('id', session.user.id).maybeSingle();
      this.profile = (data as Profile) ?? null;
    },
    /** Signs in AND loads the profile before returning, so callers can check the role right away. */
    async signIn(email: string, password: string) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw new Error(error.message);
      await this.apply(data.session);
    },
    async signOut() {
      await supabase.auth.signOut();
    },
  },
});
