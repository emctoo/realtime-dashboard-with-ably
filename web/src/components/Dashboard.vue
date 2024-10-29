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

        <!-- Login Button / User Info -->
        <div class="border-l border-gray-800 pl-4">
          <template v-if="isAuthenticated">
            <div class="flex items-center gap-3">
              <span class="text-gray-400">{{ userInfo.username }}</span>
              <span v-if="isPremium" class="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">PREMIUM</span>
              <button @click="handleLogout" class="text-gray-400 hover:text-white transition-colors">
                Logout
              </button>
            </div>
          </template>
          <button v-else @click="showLoginModal = true" class="px-4 py-2 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors">
            Login
          </button>
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
    <div class="fixed left-0 right-0 bottom-0 z-10" :class="{ 'h-[40vh]': !eventsCollapsed, 'h-16': eventsCollapsed}">
      <div class="max-w-7xl mx-auto px-4">
        <div class="rounded-t-lg w-full transition-all duration-300 ease-out"
          :class="{ 'h-[40vh]': !eventsCollapsed, 'h-16': eventsCollapsed }">
          <div class="bg-[#1a1f2e]/30 backdrop-blur-sm rounded-t-lg border border-gray-800/50 h-full">
            <RaceEvents :is-collapsed="eventsCollapsed" @toggle-collapse="handleEventsCollapse"/>
          </div>
        </div>
      </div>
    </div>
   
    <!-- Login Modal -->
    <LoginModal :show="showLoginModal" @close="showLoginModal = false" @success="handleLoginSuccess"/>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { storeToRefs } from 'pinia';
import { useAblyStore } from "../stores/ably";
import { useRaceEventsStore } from "../stores/raceEvents";
import { useAuthStore } from "../stores/auth"
import LoginModal from "./LoginModal.vue";
import CarSelector from "./CarSelector.vue";
import TelemetryChart from "./TelemetryChart.vue";
import TrackView from "./TrackView.vue";
import RaceEvents from "./RaceEvents.vue";

// ably store
const ablyStore = useAblyStore();
const { isConnected, connectionState, error } = storeToRefs(ablyStore);
const raceEventsStore = useRaceEventsStore();

// Auth Store
const authStore = useAuthStore();
const { isAuthenticated, isPremium, userInfo } = storeToRefs(authStore);
const showLoginModal = ref(false);

// Connection Status Display
const connectionStatusClass = computed(() => ({
  'bg-green-500': isConnected.value,
  'bg-yellow-500': connectionState.value === 'connecting',
  'bg-red-500': connectionState.value === 'failed' || !!error.value,
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

// Methods
const getTrackStatusColor = (status) => {
  const colors = {
    DRY: "text-green-400",
    WET: "text-blue-400",
    DAMP: "text-yellow-400",
  };
  return colors[status] || "text-gray-400";
};

const handleLoginSuccess = () => {
  // Handle post-login logic here
  console.log('Login successful');
};

const handleLogout = () => {
  authStore.logout();
  // Handle post-logout cleanup here
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
    const prevChannelName = ablyStore.getChannelName('telemetry', selectedCar.value);
    await ablyStore.unsubscribe(prevChannelName);

    // 清除现有数据
    telemetryData.value = [];

    // 创建新订阅
    const channelName = ablyStore.getChannelName('telemetry', carId);
    await ablyStore.subscribe(channelName, (message) => {
      telemetryData.value.push(message.data);
      if (telemetryData.value.length > 60) {
        telemetryData.value.shift();
      }
    });
    console.log(`subscribe to ${channelName}`);
  } catch (err) {
    console.error('Failed to subscribe to car telemetry:', err);
  }
};

const subscribeToWeather = async () => {
  try {
    const channelName = ablyStore.getChannelName('weather', 'track');
    await ablyStore.subscribe(channelName, (message) => {
      weatherData.value = { ...weatherData.value, ...message.data };
    });
  } catch (err) {
    console.error('Failed to subscribe to weather updates:', err);
  }
};

// Component lifecycle
onMounted(async () => {
  authStore.init();

  if (isConnected.value) {
    // 如果已连接,直接订阅所需channels
    await Promise.all([
      subscribeToCar(selectedCar.value),
      subscribeToWeather(),
    ]);
  } else {
    // 监听连接状态,连接成功后订阅
    const unwatch = watch(() => isConnected.value, async (newValue) => {
      if (newValue) {
        await Promise.all([
          subscribeToCar(selectedCar.value),
          subscribeToWeather(),
        ]);
        unwatch();
      }
    });
  }
});

onUnmounted(async () => {
  // 组件卸载时清理所有订阅
  const channels = [
    ablyStore.getChannelName('telemetry', selectedCar.value),
    ablyStore.getChannelName('weather', 'track')
  ];

  for (const channelName of channels) {
    await ablyStore.unsubscribe(channelName);
  }
});
</script>

<style scoped>
.bg-navy {
  background-color: #0a0d1a;
}
</style>