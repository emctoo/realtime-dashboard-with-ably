<template>
    <div class="min-h-screen bg-navy flex flex-col">
        <!-- Connection Status -->
        <div v-if="!isConnected || error" 
             class="fixed top-0 left-0 right-0 p-2 text-center text-sm font-medium z-50"
             :class="connectionStatusClass">
            {{ connectionMessage }}
        </div>

        <!-- Header -->
        <header class="w-full p-4 text-white">
            <div class="max-w-7xl mx-auto flex justify-between items-center">
                <div class="flex items-center space-x-8">
                    <!-- Race Info -->
                    <div>
                        <h1 class="text-2xl font-bold">Austrian Grand Prix</h1>
                        <p class="text-gray-400">Red Bull Ring</p>
                    </div>
                    
                    <!-- Race Progress -->
                    <div class="flex items-center space-x-2">
                        <span class="text-xl font-semibold">LAP {{ currentLap }}/{{ totalLaps }}</span>
                    </div>
                </div>
                
                <!-- Weather Info -->
                <div class="weather-info flex items-center space-x-6">
                    <div class="flex items-center space-x-2">
                        <span class="text-gray-400">Track Temp:</span>
                        <span>{{ weatherData.trackTemp }}°C</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="text-gray-400">Humidity:</span>
                        <span>{{ weatherData.humidity }}%</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="text-gray-400">Wind:</span>
                        <span>{{ weatherData.windSpeed }} km/h {{ weatherData.windDirection }}</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span>Track Status:</span>
                        <span :class="getTrackStatusColor(weatherData.trackStatus)">
                            {{ weatherData.trackStatus }}
                        </span>
                    </div>
                </div>
            </div>
        </header>

        <!-- Main Content Area -->
        <main class="flex-1 w-full max-w-7xl mx-auto p-4 flex flex-col">
            <!-- Telemetry Section -->
            <div 
                class="grid grid-cols-12 gap-4 transition-all duration-300 ease-out"
                :style="{
                    height: `calc(100vh - ${eventsCollapsed ? '8rem' : '20rem'})`
                }"
            >
                <!-- Left Column - Car Selection -->
                <div class="col-span-2">
                    <div class="bg-[#1a1f2e]/50 backdrop-blur-sm rounded-lg h-full overflow-hidden">
                        <CarSelector
                            :cars="cars"
                            :selectedCar="selectedCar"
                            @select="handleCarSelect"
                        />
                    </div>
                </div>

                <!-- Right Column - Telemetry Chart -->
                <div class="col-span-10">
                    <div class="bg-[#1a1f2e]/50 backdrop-blur-sm rounded-lg p-4 h-full flex flex-col">
                        <div class="h-[250px]">
                            <TelemetryChart
                                :data="telemetryData"
                                :carId="selectedCar"
                            />
                        </div>
                        <div class="flex-1">
                            <TrackView
                                :cars="cars"
                                :selectedCar="selectedCar"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <!-- Floating Race Events Panel -->
        <div 
            class="fixed left-0 right-0 bottom-0 z-10"
            :class="{
                'h-[40vh]': !eventsCollapsed,
                'h-16': eventsCollapsed
            }"
        >
            <div class="max-w-7xl mx-auto px-4">
                <div 
                    class="rounded-t-lg w-full transition-all duration-300 ease-out"
                    :class="{
                        'h-[40vh]': !eventsCollapsed,
                        'h-16': eventsCollapsed
                    }"
                >
                    <div class="bg-[#1a1f2e]/30 backdrop-blur-sm rounded-t-lg border border-gray-800/50 h-full">
                        <RaceEvents 
                            :events="raceEvents"
                            :is-collapsed="eventsCollapsed"
                            @toggle-collapse="handleEventsCollapse"
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import CarSelector from "./CarSelector.vue";
import TelemetryChart from "./TelemetryChart.vue";
import TrackView from "./TrackView.vue";
import RaceEvents from "./RaceEvents.vue";
import { ablyService } from "../services/ably";

// Connection State
const isConnected = ref(false);
const error = ref(null);
const connectionStatus = ref('disconnected');

// Computed for connection display
const connectionStatusClass = computed(() => ({
    'bg-green-500': isConnected.value,
    'bg-yellow-500': connectionStatus.value === 'connecting',
    'bg-red-500': connectionStatus.value === 'failed' || !!error.value,
    'text-white': true,
}));

const connectionMessage = computed(() => {
    if (error.value) return error.value;
    if (!isConnected.value) return 'Connecting to real-time service...';
    return '';
});

// State
const currentLap = ref(24);
const totalLaps = ref(78);
const selectedCar = ref("car1");
const eventsCollapsed = ref(true);
const telemetryData = ref([]);
const cars = ref([
    {
        id: "car1",
        number: "44",
        driver: "Lewis Hamilton",
        position: 1,
        gap: 0,
        team: "Mercedes",
    },
    {
        id: "car2",
        number: "33",
        driver: "Max Verstappen",
        position: 2,
        gap: 1.2,
        team: "Red Bull",
    },
    {
        id: "car3",
        number: "16",
        driver: "Charles Leclerc",
        position: 3,
        gap: 2.5,
        team: "Ferrari",
    },
]);

const weatherData = ref({
    trackTemp: 45,
    humidity: 65,
    windSpeed: 12,
    windDirection: "NW",
    rainChance: 0,
    trackStatus: "DRY",
});

const raceEvents = ref([]);

// Subscriptions storage
const activeSubscriptions = ref(new Map());

// Methods
const getTrackStatusColor = (status) => {
    const colors = {
        DRY: "text-green-400",
        WET: "text-blue-400",
        DAMP: "text-yellow-400",
    };
    return colors[status] || "text-gray-400";
};

const handleEventsCollapse = () => {
    eventsCollapsed.value = !eventsCollapsed.value;
};

const handleCarSelect = async (carId) => {
    selectedCar.value = carId;
    await subscribeToCar(carId);
};

// Subscription handlers
const subscribeToCar = async (carId) => {
    try {
        // 取消之前的订阅
        if (activeSubscriptions.value.has('telemetry')) {
            const prevSub = activeSubscriptions.value.get('telemetry');
            await ablyService.unsubscribe(prevSub);
        }

        // 清除现有数据
        telemetryData.value = [];

        // 创建新订阅
        const channelName = ablyService.getChannelName('telemetry', carId);
        const subscription = await ablyService.subscribeToChannel(channelName, (message) => {
            telemetryData.value.push(message.data);
            if (telemetryData.value.length > 60) {
                telemetryData.value.shift();
            }
        });

        activeSubscriptions.value.set('telemetry', subscription);
    } catch (err) {
        console.error('Failed to subscribe to car telemetry:', err);
        error.value = `Failed to subscribe to car telemetry: ${err.message}`;
    }
};

const subscribeToRaceEvents = async () => {
    try {
        const channelName = ablyService.getChannelName('race', 'events');
        const subscription = await ablyService.subscribeToChannel(channelName, (message) => {
            raceEvents.value.unshift(message.data);
            // 限制事件数量
            if (raceEvents.value.length > 100) {
                raceEvents.value.pop();
            }
        });

        activeSubscriptions.value.set('events', subscription);
    } catch (err) {
        console.error('Failed to subscribe to race events:', err);
        error.value = `Failed to subscribe to race events: ${err.message}`;
    }
};

const subscribeToWeather = async () => {
    try {
        const channelName = ablyService.getChannelName('weather', 'track');
        const subscription = await ablyService.subscribeToChannel(channelName, (message) => {
            weatherData.value = { ...weatherData.value, ...message.data };
        });

        activeSubscriptions.value.set('weather', subscription);
    } catch (err) {
        console.error('Failed to subscribe to weather updates:', err);
        error.value = `Failed to subscribe to weather updates: ${err.message}`;
    }
};

// Connection status monitoring
watch(() => ablyService.connectionState.value, (newState) => {
    console.log(`connection state changes: ${newState} ...`);
    connectionStatus.value = newState;
    isConnected.value = newState === 'connected';
    console.log(`connected: ${isConnected}`);
    
    if (newState === 'connected') {
        error.value = null;
    }
});

// Component lifecycle
onMounted(async () => {
    try {
        // 初始化Ably
        await ablyService.initialize(import.meta.env.VITE_ABLY_API_KEY);
        
        // 订阅所有需要的channels
        await Promise.all([
            subscribeToCar(selectedCar.value),
            subscribeToRaceEvents(),
            subscribeToWeather(),
        ]);
        
    } catch (err) {
        console.error('Failed to initialize dashboard:', err);
        error.value = `Failed to initialize dashboard: ${err.message}`;
    }
});

onUnmounted(async () => {
    // 清理所有订阅
    for (const [key, subscription] of activeSubscriptions.value) {
        await ablyService.unsubscribe(subscription);
    }
    activeSubscriptions.value.clear();
    
    // 断开Ably连接
    await ablyService.disconnect();
});
</script>

<style scoped>
.bg-navy {
    background-color: #0a0d1a;
}
</style>
