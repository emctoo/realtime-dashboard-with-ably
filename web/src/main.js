import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './style.css';
import App from './App.vue';
import { useAblyStore } from './stores/ably';
import { useAuthStore } from './stores/auth';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// Initialize stores
const ablyStore = useAblyStore();
const authStore = useAuthStore();

Promise
  .all([
    ablyStore.initialize(),
    authStore.init()
  ])
  .catch(err => {
    console.error('Failed to initialize stores:', err);
  });

app.mount('#app');