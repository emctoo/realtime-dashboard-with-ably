<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('update:show', false)"></div>
      
      <!-- Modal -->
      <div class="relative bg-[#1a1f2e] rounded-lg shadow-xl w-full max-w-md p-6 border border-gray-800">
        <!-- Header -->
        <div class="mb-4">
          <h2 class="text-xl font-bold text-white">Premium Feature</h2>
        </div>
        
        <!-- Content -->
        <div class="mb-6">
          <p class="text-gray-400">
            Fuel telemetry data is only available for premium subscribers. 
            Upgrade your account to access this feature.
          </p>
        </div>
        
        <!-- Footer -->
        <div class="flex justify-end">
          <button
            @click="$emit('update:show', false)"
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  show: {
    type: Boolean,
    required: true
  }
});

defineEmits(['update:show']);
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-to,
.modal-leave-from {
  opacity: 1;
}
</style>