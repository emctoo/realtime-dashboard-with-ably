<template>
    <div class="telemetry-chart text-white">
        <!-- Metric Controls -->
        <div class="flex gap-2 mb-4">
            <button
                v-for="metric in metrics"
                :key="metric.id"
                @click="currentMetric = metric.id"
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
import { ref, computed, onMounted, onUnmounted } from "vue";
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

const props = defineProps({
    data: {
        type: Array,
        required: true,
        default: () => [],
    },
    carId: {
        type: String,
        required: true,
    },
});

const currentMetric = ref("speed");
const metrics = [
    { id: "speed", label: "Speed", color: "#3B82F6", icon: SpeedIcon },
    { id: "temp", label: "Temp", color: "#EF4444", icon: TempIcon },
    { id: "fuel", label: "Fuel", color: "#10B981", icon: FuelIcon },
];

let updateInterval;
const mockData = ref([]);

// 生成初始数据
const generateInitialData = (length = 60) => {
    const now = Date.now();
    return Array.from({ length }, (_, i) => ({
        timestamp: now - (length - i) * 1000,
        speed: 280 + Math.random() * 40,
        temp: 90 + Math.random() * 10,
        fuel: 100 - (i * 0.5 + Math.random() * 2),
    }));
};

// 更新数据的函数
const updateMockData = () => {
    const newData = [...mockData.value.slice(1)];
    const lastTimestamp = newData[newData.length - 1].timestamp;
    newData.push({
        timestamp: lastTimestamp + 1000,
        speed: 280 + Math.random() * 40,
        temp: 90 + Math.random() * 10,
        fuel: newData[newData.length - 1].fuel - (0.5 + Math.random() * 0.5),
    });
    mockData.value = newData;
};

const chartData = computed(() => ({
    labels: mockData.value.map(d => {
        const date = new Date(d.timestamp);
        return `${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    }),
    datasets: [
        {
            label: metrics.find(m => m.id === currentMetric.value).label,
            data: mockData.value.map(d => d[currentMetric.value]),
            borderColor: metrics.find(m => m.id === currentMetric.value).color,
            backgroundColor: `${metrics.find(m => m.id === currentMetric.value).color}20`,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            borderWidth: 2,
        },
    ],
}));

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false, // 禁用所有动画
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
                    let suffix = currentMetric.value === 'speed' ? ' km/h'
                        : currentMetric.value === 'temp' ? '°C'
                        : '%';
                    return `${context.parsed.y.toFixed(1)}${suffix}`;
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
                    let suffix = currentMetric.value === 'speed' ? ' km/h'
                        : currentMetric.value === 'temp' ? '°C'
                        : '%';
                    return `${value}${suffix}`;
                }
            },
        },
    },
    interaction: {
        intersect: false,
        mode: 'index',
    },
};

onMounted(() => {
    // 初始化数据
    mockData.value = generateInitialData();
    // 设置更新间隔
    updateInterval = setInterval(updateMockData, 1000);
});

onUnmounted(() => {
    // 清理定时器
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});
</script>