import { defineStore } from 'pinia';
import { useAblyStore } from './ably';

export const useRaceEventsStore = defineStore('raceEvents', {
  state: () => ({
    events: [],
    currentFilter: 'All',
    loading: false,
    error: null,
    maxEvents: 100,
    eventTypesWhenCollapsed: ['Flag', 'Penalty', 'Pit', 'Incident']
  }),

  getters: {
    filteredEvents: (state) => {
      if (state.currentFilter === 'All') {
        return state.events;
      }
      return state.events.filter(
        event => event.type === state.currentFilter.toUpperCase()
      );
    },

    hasError: (state) => !!state.error,
    
    eventTypes: (state) => ['All', ...state.eventTypesWhenCollapsed],

    eventTypeStyles: () => ({
      FLAG: "bg-yellow-500/10",
      PENALTY: "bg-red-500/10",
      PIT: "bg-blue-500/10",
      INCIDENT: "bg-orange-500/10"
    }),

    eventLabelStyles: () => ({
      FLAG: "bg-yellow-500/20 text-yellow-400",
      PENALTY: "bg-red-500/20 text-red-400", 
      PIT: "bg-blue-500/20 text-blue-400",
      INCIDENT: "bg-orange-500/20 text-orange-400"
    })
  },

  actions: {
    setFilter(filter) {
      this.currentFilter = filter;
    },

    addEvent(event) {
      // 添加事件到数组开头
      this.events.unshift(event);
      
      // 限制事件数量
      if (this.events.length > this.maxEvents) {
        this.events.pop();
      }

      // 调整事件类型顺序
      this.adjustEventTypeOrder(event.type);
    },

    adjustEventTypeOrder(eventType) {
      // 将事件类型转换为首字母大写格式
      const formattedType = eventType.charAt(0).toUpperCase() + eventType.slice(1).toLowerCase();
      
      if (this.eventTypesWhenCollapsed.includes(formattedType)) {
        // 移除当前位置
        const index = this.eventTypesWhenCollapsed.indexOf(formattedType);
        this.eventTypesWhenCollapsed.splice(index, 1);
        
        // 添加到开头
        this.eventTypesWhenCollapsed.unshift(formattedType);
      }
    },

    clearEvents() {
      this.events = [];
      this.error = null;
    },

    async subscribeToRaceEvents() {
      this.loading = true;
      this.error = null;
      
      try {
        const ablyStore = useAblyStore();
        const channelName = ablyStore.getChannelName('race', 'events');
        
        console.log(`RE / subscribing to ${channelName}`);
        await ablyStore.subscribe(channelName, (message) => {
            console.log('RE / received message:', message.data);
            this.addEvent(message.data);          
        });
        
        this.loading = false;
      } catch (err) {
        this.error = 'Failed to subscribe to race events: ' + err.message;
        this.loading = false;
        throw err;
      }
    },

    async unsubscribeFromRaceEvents() {
      try {
        const ablyStore = useAblyStore();
        const channelName = ablyStore.getChannelName('race', 'events');
        await ablyStore.unsubscribe(channelName);
      } catch (err) {
        this.error = 'Failed to unsubscribe from race events: ' + err.message;
        throw err;
      }
    },

    getFilterStyle(filter) {
      if (filter === 'All') {
        return this.currentFilter === 'All'
          ? "bg-gray-500/50 text-white"
          : "bg-gray-800/50 text-gray-400 hover:bg-gray-700/50";
      }

      const styleMap = {
        Flag: {
          active: "bg-yellow-500/30 text-yellow-300",
          inactive: "bg-yellow-500/10 text-yellow-400/70 hover:bg-yellow-500/20"
        },
        Penalty: {
          active: "bg-red-500/30 text-red-300",
          inactive: "bg-red-500/10 text-red-400/70 hover:bg-red-500/20"
        },
        Pit: {
          active: "bg-blue-500/30 text-blue-300",
          inactive: "bg-blue-500/10 text-blue-400/70 hover:bg-blue-500/20"
        },
        Incident: {
          active: "bg-orange-500/30 text-orange-300",
          inactive: "bg-orange-500/10 text-orange-400/70 hover:bg-orange-500/20"
        }
      };

      return this.currentFilter === filter
        ? styleMap[filter].active
        : styleMap[filter].inactive;
    }
  }
});