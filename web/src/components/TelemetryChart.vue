<template>
    <div class="telemetry-chart text-white">
        <!-- Metric Controls -->
        <div class="flex gap-2 mb-4">
            <button
                v-for="metric in telemetryStore.metrics"
                :key="metric.id"
                @click="handleMetricChange(metric.id)"
                class="px-3 py-1.5 text-xs font-medium rounded transition-colors duration-200 relative overflow-hidden"
                :class="[
                    telemetryStore.currentMetric === metric.id 
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' 
                        : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:border-gray-600/50'
                ]"
            >
                <div class="flex items-center gap-1.5">
                    <component :is="metric.icon" class="w-3.5 h-3.5" />
                    {{ metric.label }}
                </div>
            </button>
        </div>

        <!-- Chart Container -->
        <div class="relative h-[calc(100%-2.5rem)]">
            <LineChart 
                v-if="telemetryStore.chartData" 
                :data="telemetryStore.chartData" 
                :options="telemetryStore.chartOptions" 
                class="h-full"
            />
        </div>
    </div>
</template>

<script setup>
import { onUnmounted, watch } from "vue";
import { storeToRefs } from 'pinia';
import { useAblyStore } from "../stores/ably";
import { useTelemetryStore } from "../stores/telemetry";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from "chart.js";
import { Line as LineChart } from "vue-chartjs";

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
);

const props = defineProps({
    carId: {
        type: String,
        required: true
    }
});

// Store setup
const telemetryStore = useTelemetryStore();
const ablyStore = useAblyStore();
const { connectionState } = storeToRefs(ablyStore);

// Handle metric change
const handleMetricChange = async (metric) => {
    telemetryStore.setMetric(metric);
    if (connectionState.value === 'connected') {
        await telemetryStore.subscribeToCar(props.carId);
    }
};

// Watch for car changes
watch(() => props.carId, async (newCarId) => {
    if (newCarId && connectionState.value === 'connected') {
        await telemetryStore.subscribeToCar(newCarId);
    }
});

// Watch for connection state changes
const unwatchConnection = watch(
    () => connectionState.value,
    async (newState, oldState) => {
        console.log(`Telemetry / Ably connection state changed: ${oldState} -> ${newState}`);
        if (newState === 'connected') {
            await telemetryStore.subscribeToCar(props.carId);
        } else if (newState === 'disconnected' || newState === 'failed') {
            await telemetryStore.unsubscribeFromCar();
        }
    },
    { immediate: true }
);

// Component cleanup
onUnmounted(() => {
    unwatchConnection(); // Clean up connection watcher
    telemetryStore.unsubscribeFromCar();
});
</script>