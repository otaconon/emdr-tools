import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import Host from './pages/Host.vue';
import Client from './pages/Client.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/host',
    name: 'Host',
    component: Host
  },
  {
    path: '/client',
    name: 'Client',
    component: Client
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;