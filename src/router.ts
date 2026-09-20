import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '@/stores/auth';
import { isConfigured } from '@/lib/supabase';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('@/views/Login.vue'), meta: { public: true } },
    // Customer-facing homepage: anyone can look a vehicle up; staff sign in from here.
    { path: '/', component: () => import('@/views/Portal.vue'), meta: { public: true, portal: true } },
    { path: '/statement', component: () => import('@/views/CustomerStatement.vue'), meta: { public: true, portal: true, print: true } },
    { path: '/dashboard', component: () => import('@/views/Dashboard.vue') },
    { path: '/job-orders', component: () => import('@/views/JobOrders.vue') },
    { path: '/job-orders/:id', component: () => import('@/views/JobOrderDetail.vue') },
    { path: '/vehicles', component: () => import('@/views/Vehicles.vue') },
    { path: '/vehicles/:id', component: () => import('@/views/VehicleDetail.vue') },
    { path: '/technicians', component: () => import('@/views/Technicians.vue') },
    { path: '/inventory', component: () => import('@/views/Inventory.vue') },
    { path: '/charges', component: () => import('@/views/Charges.vue') },
    { path: '/settings', component: () => import('@/views/Settings.vue') },
    { path: '/print/:kind/:id', component: () => import('@/views/PrintDocument.vue'), meta: { print: true } },
    { path: '/audit', component: () => import('@/views/Audit.vue') },
  ],
});

router.beforeEach(async (to) => {
  if (!isConfigured) return true; // App.vue shows the configuration notice.
  const auth = useAuth();
  if (!auth.ready) await auth.init();
  if (to.meta.portal) return true;
  if (to.meta.public) return auth.session && auth.isAdmin ? '/dashboard' : true;
  if (!auth.session || !auth.isAdmin) return '/login';
  return true;
});
