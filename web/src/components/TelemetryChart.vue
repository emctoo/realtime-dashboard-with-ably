<template>
    <div class="telemetry-chart text-white">
        <!-- Metric Controls -->
        <div class="flex gap-2 mb-4">
            <button
                v-for="metric in metrics"
                :key="metric.id"
                @click="handleMetricChange(metric.id)"
                class="px-3 py-1.5 text-xs font-medium rounded transition-colors duration-200 relative overflow-hidden"
                :class="[
                    currentMetric === metric.id 
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
                v-if="chartData" 
                :data="chartData" 
                :options="chartOptions" 
                class="h-full"
            />
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useAblyStore } from "../stores/ably";
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

// Ably store
const ablyStore = useAblyStore();

// Icons as components
const SpeedIcon = {
    template: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2v2M2 12h2m16 0h2M12 20v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
        <path d="M12 9v1"/>
    </svg>`
};

const TempIcon = {
    template: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
    </svg>`
};

const FuelIcon = {
    template: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 22h12M4 9h10M4 6h10M4 3h10M14 19V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14M14 13h2a2 2 0 0 1 2 2v4M20 15h-4"/>
    </svg>`
};

// State
const currentMetric = ref("speed");
const telemetryData = ref([]);
const maxDataPoints = 60; // 保留60个数据点

const metrics = [
    { id: "speed", label: "Speed", color: "#3B82F6", icon: SpeedIcon, unit: "km/h", max: 340, min: 0 },
    { id: "temp", label: "Temp", color: "#EF4444", icon: TempIcon, unit: "°C", max: 120, min: 60 },
    { id: "fuel", label: "Fuel", color: "#10B981", icon: FuelIcon, unit: "%", max: 100, min: 0 }
];

// 获取当前指标的配置
const currentMetricConfig = computed(() => 
    metrics.find(m => m.id === currentMetric.value)
);

// Format data for chart
const chartData = computed(() => ({
    labels: telemetryData.value.map(d => {
        const date = new Date(d.timestamp);
        return `${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    }),
    datasets: [
        {
            label: currentMetricConfig.value.label,
            data: telemetryData.value.map(d => d.value),
            borderColor: currentMetricConfig.value.color,
            backgroundColor: `${currentMetricConfig.value.color}20`,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            borderWidth: 2,
        },
    ],
}));

// Chart options
const chartOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    animations: {
        colors: false,
        x: false,
    },
    transitions: {
        active: {
            animation: {
                duration: 0
            }
        }
    },
    plugins: {
        legend: {
            display: false,
        },
        tooltip: {
            enabled: true,
            mode: 'index',
            intersect: false,
            animation: false,
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: 'rgba(255, 255, 255, 0.8)',
            bodyColor: 'rgba(255, 255, 255, 0.8)',
            borderColor: 'rgba(148, 163, 184, 0.2)',
            borderWidth: 1,
            padding: 8,
            displayColors: false,
            callbacks: {
                label: (context) => {
                    return `${context.parsed.y.toFixed(1)}${currentMetricConfig.value.unit}`;
                }
            }
        },
    },
    scales: {
        x: {
            display: true,
            grid: {
                display: true,
                color: 'rgba(148, 163, 184, 0.1)',
            },
            ticks: {
                color: 'rgba(148, 163, 184, 0.7)',
                font: {
                    size: 10,
                },
                maxRotation: 0,
                maxTicksLimit: 6,
            },
        },
        y: {
            display: true,
            min: currentMetricConfig.value.min,
            max: currentMetricConfig.value.max,
            grid: {
                display: true,
                color: 'rgba(148, 163, 184, 0.1)',
            },
            ticks: {
                color: 'rgba(148, 163, 184, 0.7)',
                font: {
                    size: 10,
                },
                callback: (value) => {
                    return `${value}${currentMetricConfig.value.unit}`;
                }
            },
        },
    },
    interaction: {
        intersect: false,
        mode: 'index',
    },
}));

// Subscription management
let currentSubscription = null;

const subscribeToMetric = async (metric) => {
    // 取消之前的订阅
    if (currentSubscription) {
        const prevChannelName = ablyStore.getChannelName('telemetry', `${props.carId}:${currentMetric.value}`);
        await ablyStore.unsubscribe(prevChannelName);
    }

    // 清除现有数据
    telemetryData.value = [];

    // 订阅新的指标
    const channelName = ablyStore.getChannelName('telemetry', `${props.carId}:${metric}`);
    await ablyStore.subscribe(channelName, (message) => {
        telemetryData.value.push({
            timestamp: message.data.timestamp,
            value: message.data[metric]
        });

        // 保持固定数量的数据点
        if (telemetryData.value.length > maxDataPoints) {
            telemetryData.value.shift();
        }
    });
};

// Handle metric change
const handleMetricChange = async (metric) => {
    currentMetric.value = metric;
    await subscribeToMetric(metric);
};

// Watch for car changes
watch(() => props.carId, async (newCarId) => {
    if (newCarId) {
        await subscribeToMetric(currentMetric.value);
    }
});

// Component lifecycle
onMounted(async () => {
    await subscribeToMetric(currentMetric.value);
});

onUnmounted(async () => {
    if (currentSubscription) {
        const channelName = ablyStore.getChannelName('telemetry', `${props.carId}:${currentMetric.value}`);
        await ablyStore.unsubscribe(channelName);
    }
});
</script>