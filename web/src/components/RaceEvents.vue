<template>
    <div class="race-events text-white h-full">
        <!-- Debug: {{ collapsed }} -->
        <div class="flex justify-between items-center">
            <div class="flex items-center gap-4">
                <h2 class="text-xl font-semibold">Race Events</h2>
                <div v-show="!collapsed" class="flex gap-1.5">
                    <button
                        v-for="filter in filters"
                        :key="filter"
                        @click="currentFilter = filter"
                        :class="[
                            'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                            getFilterStyle(filter),
                        ]"
                    >
                        {{ filter }}
                    </button>
                </div>
            </div>
            
            <!-- Toggle Button -->
            <button 
                @click="toggleCollapse"
                class="w-8 h-8 rounded-full bg-gray-800/50 hover:bg-gray-700/50 transition-colors flex items-center justify-center"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    class="w-5 h-5 transition-transform duration-300"
                    :class="{ 'rotate-180': collapsed }"
                >
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
        </div>

        <div 
            v-show="!collapsed"
            class="events-list mt-3 space-y-1 overflow-y-auto pr-2 custom-scrollbar"
            style="max-height: calc(100% - 3rem);"
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
        </div>
    </div>
</template>

<script setup>
import { computed, ref, toRef } from "vue";

const props = defineProps({
    events: {
        type: Array,
        required: true,
        default: () => [],
    },
    isCollapsed: {
        type: Boolean,
        required: true,
    }
});
const collapsed = toRef(props, 'isCollapsed');
const emit = defineEmits(['toggle-collapse']);

const isCollapsed = ref(false);
const currentFilter = ref("All");
const filters = ["All", "Flag", "Penalty", "Pit", "Incident"];

const toggleCollapse = () => {
    emit('toggle-collapse');
    console.log('Toggle clicked, current state:', collapsed.value);
};

const eventTypeStyles = {
    FLAG: "bg-yellow-500/10",
    PENALTY: "bg-red-500/10",
    PIT: "bg-blue-500/10",
    INCIDENT: "bg-orange-500/10",
};

const eventLabelStyles = {
    FLAG: "bg-yellow-500/20 text-yellow-400",
    PENALTY: "bg-red-500/20 text-red-400",
    PIT: "bg-blue-500/20 text-blue-400",
    INCIDENT: "bg-orange-500/20 text-orange-400",
};

const getFilterStyle = (filter) => {
    if (filter === "All") {
        return currentFilter.value === "All"
            ? "bg-gray-500/50 text-white"
            : "bg-gray-800/50 text-gray-400 hover:bg-gray-700/50";
    }

    const styleMap = {
        Flag: {
            active: "bg-yellow-500/30 text-yellow-300",
            inactive: "bg-yellow-500/10 text-yellow-400/70 hover:bg-yellow-500/20",
        },
        Penalty: {
            active: "bg-red-500/30 text-red-300",
            inactive: "bg-red-500/10 text-red-400/70 hover:bg-red-500/20",
        },
        Pit: {
            active: "bg-blue-500/30 text-blue-300",
            inactive: "bg-blue-500/10 text-blue-400/70 hover:bg-blue-500/20",
        },
        Incident: {
            active: "bg-orange-500/30 text-orange-300",
            inactive: "bg-orange-500/10 text-orange-400/70 hover:bg-orange-500/20",
        },
    };

    return currentFilter.value === filter
        ? styleMap[filter].active
        : styleMap[filter].inactive;
};

const filteredEvents = computed(() => {
    if (currentFilter.value === "All") {
        return props.events;
    }
    return props.events.filter(
        (event) => event.type === currentFilter.value.toUpperCase()
    );
});

const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
    });
};
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
</style>