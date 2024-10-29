import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ablyService } from '../services/ably';

export const useRaceStore = defineStore('race', () => {
  // 状态
  const connectionStatus = ref('disconnected');
  const error = ref(null);
  const isConnected = ref(false);

  const currentLap = ref(24);
  const totalLaps = ref(78);
  const selectedCar = ref('car1');
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
  const activeSubscriptions = ref(new Map());

  // getters
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

  // actions
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

  const initialize = async () => {
    try {
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
  };

  const cleanup = async () => {
    // 清理所有订阅
    for (const [key, subscription] of activeSubscriptions.value) {
      await ablyService.unsubscribe(subscription);
    }
    activeSubscriptions.value.clear();

    // 断开Ably连接
    await ablyService.disconnect();
  };

  const setSelectedCar = async (carId) => {
    selectedCar.value = carId;
    await subscribeToCar(carId);
  };

  const updateConnectionStatus = (newState) => {
    connectionStatus.value = newState;
    isConnected.value = newState === 'connected';

    if (newState === 'connected') {
      error.value = null;
    }
  };

  return {
    // state
    connectionStatus,
    error,
    isConnected,
    currentLap,
    totalLaps,
    selectedCar,
    telemetryData,
    cars,
    weatherData,
    raceEvents,

    // getters
    connectionStatusClass,
    connectionMessage,

    // actions
    initialize,
    cleanup,
    setSelectedCar,
    updateConnectionStatus,
  };
});
