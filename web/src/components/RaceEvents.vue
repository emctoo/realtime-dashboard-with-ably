<template>
  <div class="race-events text-white h-full">
    <!-- Header Section -->
    <div class="flex justify-between items-center">
      <div class="flex items-center gap-4">
        <h2 class="text-xl font-semibold">Race Events</h2>
        <TransitionGroup 
          name="filter-list" 
          tag="div" 
          class="flex gap-1.5"
        >
          <button
            v-for="filter in eventTypesWhenCollapsed"
            :key="filter"
            @click="handleFilterChange(filter)"
            :class="[
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              raceEventsStore.getFilterStyle(filter),
            ]"
          >
            {{ filter }}
          </button>
        </TransitionGroup>
      </div>
      
      <!-- Toggle Button -->
      <button 
        @click="$emit('toggle-collapse')"
        class="w-8 h-8 rounded-full bg-gray-800/50 hover:bg-gray-700/50 transition-colors flex items-center justify-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="w-5 h-5 transition-transform duration-300"
          :class="{ 'rotate-180': isCollapsed }"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    </div>

    <!-- Events List -->
    <div 
      v-show="!isCollapsed"
      class="events-list mt-3 space-y-1 overflow-y-auto pr-2 custom-scrollbar"
      style="max-height: calc(100% - 3rem);"
    >
      <TransitionGroup 
        name="event-list"
        tag="div"
        class="space-y-1"
      >
        <div
          v-for="event in filteredEvents"
          :key="event.id"
          class="event-item rounded-lg"
          :class="eventTypeStyles[event.type]"
        >
          <div class="p-2 flex items-center gap-3">
            <span class="text-xs text-gray-400 whitespace-nowrap w-12">
              {{ formatTime(event.timestamp) }}
            </span>
            <span class="text-sm flex-1 min-w-0 truncate">
              {{ event.message }}
            </span>
            <div
              class="px-2 py-0.5 rounded text-xs"
              :class="eventLabelStyles[event.type]"
            >
              {{ event.type }}
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- Error Display -->
    <div v-if="raceEventsStore.hasError" class="mt-2 text-red-400 text-sm">
      {{ raceEventsStore.error }}
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';
import { useRaceEventsStore } from '../stores/raceEvents';
import { storeToRefs } from 'pinia';

const props = defineProps({
  isCollapsed: {
    type: Boolean,
    required: true
  }
});

defineEmits(['toggle-collapse']);

// Store setup
const raceEventsStore = useRaceEventsStore();
const { 
  filteredEvents,
  eventTypes,
  eventTypesWhenCollapsed,
  eventTypeStyles,
  eventLabelStyles
} = storeToRefs(raceEventsStore);

// Methods
const handleFilterChange = (filter) => {
  raceEventsStore.setFilter(filter);
};

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Lifecycle hooks
onMounted(async () => {
  await raceEventsStore.subscribeToRaceEvents();
});

onUnmounted(async () => {
  await raceEventsStore.unsubscribeFromRaceEvents();
});
</script>

<style scoped>
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

/* 过滤器按钮动画 */
.filter-list-move {
  transition: all 0.3s ease;
}

.filter-list-enter-active,
.filter-list-leave-active {
  transition: all 0.3s ease;
}

.filter-list-enter-from,
.filter-list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* 事件列表动画 */
.event-list-move {
  transition: all 0.5s ease;
}

.event-list-enter-active {
  transition: all 0.3s ease-out;
}

.event-list-leave-active {
  transition: all 0.3s ease-in;
  position: absolute;
}

.event-list-enter-from,
.event-list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>