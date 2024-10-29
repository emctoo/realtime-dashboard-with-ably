import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './style.css';
import App from './App.vue';
import { useAblyStore } from './stores/ably';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// 初始化Ably store
const ablyStore = useAblyStore();
ablyStore.initialize(import.meta.env.VITE_ABLY_API_KEY)
  .catch(err => {
    console.error('Failed to initialize Ably:', err);
  });

app.mount('#app');