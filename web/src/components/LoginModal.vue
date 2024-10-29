<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')"></div>
    
    <!-- Modal -->
    <div class="relative bg-[#1a1f2e] rounded-lg shadow-xl w-full max-w-md p-6 border border-gray-800">
      <h2 class="text-xl font-bold text-white mb-6">Login</h2>
      
      <!-- Error Message -->
      <div v-if="error" class="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
        {{ error }}
      </div>
      
      <!-- Login Form -->
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-gray-400 text-sm mb-1">Username</label>
          <input 
            v-model="username"
            type="text"
            class="w-full bg-[#0f1219] border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            :disabled="loading"
          />
        </div>
        
        <div>
          <label class="block text-gray-400 text-sm mb-1">Password</label>
          <input 
            v-model="password"
            type="password"
            class="w-full bg-[#0f1219] border border-gray-800 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            :disabled="loading"
          />
        </div>
        
        <div class="flex justify-end gap-3 mt-6">
          <button
            type="button"
            class="px-4 py-2 rounded text-gray-400 hover:text-white transition-colors"
            @click="$emit('close')"
            :disabled="loading"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
            :disabled="loading"
          >
            {{ loading ? 'Logging in...' : 'Login' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';

const props = defineProps({
  show: Boolean
});

const emit = defineEmits(['close', 'success']);

const authStore = useAuthStore();

const username = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

const handleSubmit = async () => {
  if (!username.value || !password.value) {
    error.value = 'Please enter both username and password';
    return;
  }
  
  loading.value = true;
  error.value = '';
  
  const success = await authStore.login(username.value, password.value);
  
  if (success) {
    username.value = '';
    password.value = '';
    emit('success');
    emit('close');
  } else {
    error.value = authStore.error;
  }
  
  loading.value = false;
};
</script>