import { defineStore } from 'pinia';
import { useAblyStore } from './ably';
import { markRaw } from 'vue';

// Icons as raw components
const SpeedIcon = markRaw({
  template: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 2v2M2 12h2m16 0h2M12 20v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
    <path d="M12 9v1"/>
  </svg>`
});

const TempIcon = markRaw({
  template: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
  </svg>`
});

const FuelIcon = markRaw({
  template: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 22h12M4 9h10M4 6h10M4 3h10M14 19V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14M14 13h2a2 2 0 0 1 2 2v4M20 15h-4"/>
  </svg>`
});

export const useTelemetryStore = defineStore('telemetry', {
  state: () => ({
    telemetryData: [],
    currentMetric: 'speed',
    currentCarId: null,
    maxDataPoints: 60,
    loading: false,
    error: null,
    isSubscribed: false,
    activeChannel: null,
    metrics: [
      { 
        id: "speed", 
        label: "Speed", 
        color: "#3B82F6", 
        unit: "km/h", 
        max: 340, 
        min: 0,
        icon: SpeedIcon
      },
      { 
        id: "temp", 
        label: "Temp", 
        color: "#EF4444", 
        unit: "°C", 
        max: 120, 
        min: 60,
        icon: TempIcon
      },
      { 
        id: "fuel", 
        label: "Fuel", 
        color: "#10B981", 
        unit: "%", 
        max: 100, 
        min: 0,
        icon: FuelIcon
      }
    ]
  }),

  getters: {
    currentMetricConfig: (state) => {
      return state.metrics.find(m => m.id === state.currentMetric);
    },

    chartData: (state) => {
      if (!state.telemetryData.length) return null;

      return {
        labels: state.telemetryData.map(d => {
          const date = new Date(d.timestamp);
          return `${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
        }),
        datasets: [
          {
            label: state.currentMetricConfig.label,
            data: state.telemetryData.map(d => d.value),
            borderColor: state.currentMetricConfig.color,
            backgroundColor: `${state.currentMetricConfig.color}20`,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      };
    },

    chartOptions: (state) => ({
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
              return `${context.parsed.y.toFixed(1)}${state.currentMetricConfig.unit}`;
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
          min: state.currentMetricConfig.min,
          max: state.currentMetricConfig.max,
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
              return `${value}${state.currentMetricConfig.unit}`;
            }
          },
        },
      },
      interaction: {
        intersect: false,
        mode: 'index',
      },
    })
  },

  actions: {
    async setMetric(metric) {
      if (this.currentMetric === metric) return;
      
      // Store the new metric
      this.currentMetric = metric;
      
      // If we have a car selected, resubscribe with the new metric
      if (this.currentCarId && this.isSubscribed) {
        await this.subscribeToCar(this.currentCarId);
      }
    },

    clearData() {
      this.telemetryData = [];
      this.error = null;
    },

    processMessage(message) {
      // Extract the correct value based on the current metric
      const value = message.data[this.currentMetric];
      if (value !== undefined) {
        this.telemetryData.push({
          timestamp: message.data.timestamp,
          value: value
        });

        // Keep only last N data points
        if (this.telemetryData.length > this.maxDataPoints) {
          this.telemetryData.shift();
        }
      }
    },

    async subscribeToCar(carId) {
      this.loading = true;
      this.error = null;

      try {
        // Unsubscribe from current channel if exists
        if (this.activeChannel) {
          await this.unsubscribeFromCar();
        }

        this.currentCarId = carId;
        const ablyStore = useAblyStore();
        const channelName = ablyStore.getChannelName('telemetry', `${carId}:${this.currentMetric}`);
        
        // Clear existing data
        this.clearData();

        // Get the channel with rewind
        const channel = ablyStore.client.channels.get(channelName, {
          params: { rewind: '20' }
        });

        // Subscribe to channel
        await new Promise((resolve, reject) => {
          channel.subscribe('update', (message) => {
            this.processMessage(message);
          }, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
        
        this.activeChannel = channel;
        this.isSubscribed = true;
        console.log(`Telemetry / subscribed to ${channelName} with rewind`);

      } catch (err) {
        this.error = 'Failed to subscribe to telemetry: ' + err.message;
        this.isSubscribed = false;
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async unsubscribeFromCar() {
      if (!this.activeChannel) return;

      try {
        await this.activeChannel.unsubscribe();
        const channelName = this.activeChannel.name;
        this.activeChannel = null;
        this.isSubscribed = false;
        console.log(`Telemetry / unsubscribed from ${channelName}`);
      } catch (err) {
        this.error = 'Failed to unsubscribe from telemetry: ' + err.message;
        throw err;
      }
    }
  }
});