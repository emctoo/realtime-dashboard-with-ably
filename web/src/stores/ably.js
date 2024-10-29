import { defineStore } from 'pinia';
import * as Ably from "ably";

import { useAuthStore } from './auth';

export const useAblyStore = defineStore('ably', {
  state: () => ({
    client: null,
    connectionState: 'disconnected',
    error: null,
    subscriptions: new Map(), // 跟踪所有活跃的订阅
  }),

  getters: {
    isConnected: (state) => state.connectionState === 'connected',
    getSubscription: (state) => (channelName) => state.subscriptions.get(channelName),
  },

  actions: {
    async initialize(apiKey) {
      console.log('init ably store ...')
      try {
        // 如果已经有client，先关闭
        if (this.client) {
          await this.disconnect();
          console.log('disconnected');
        }

        // 创建新的Ably客户端        
        this.client = new Ably.Realtime({
          key: apiKey,
          clientId: `anno-web-${Math.random().toString(36).substr(2, 9)}`,
        });

        // 监听连接状态变化
        this.client.connection.on('connected', () => {
          console.log('connected');
          this.connectionState = 'connected';
          this.error = null;
        });

        this.client.connection.on('disconnected', () => {
          console.log('disconnected');
          this.connectionState = 'disconnected';
        });

        this.client.connection.on('failed', (err) => {
          console.log('failed:', err);
          this.connectionState = 'failed';
          this.error = err.message;
        });

        return new Promise((resolve, reject) => {
          this.client.connection.once('connected', () => {
            resolve();
          });
          
          this.client.connection.once('failed', (err) => {
            reject(err);
          });
        });
      } catch (err) {
        console.log(err);
        this.error = err.message;
        throw err;
      }
    },

    async subscribe(channelName, callback) {
      if (!this.client) {
        throw new Error('Ably client not initialized');
      }

      try {
        const channel = this.client.channels.get(channelName);
        
        // 存储订阅信息
        const subscription = {
          channel,
          callback,
          active: true
        };
        
        // 添加订阅
        await channel.subscribe('update', callback);
        console.log(`subscribed to ${channelName}`);
        this.subscriptions.set(channelName, subscription);
        
        return subscription;
      } catch (err) {
        this.error = `Failed to subscribe to ${channelName}: ${err.message}`;
        throw err;
      }
    },

    async unsubscribe(channelName) {
      const subscription = this.subscriptions.get(channelName);
      if (subscription && subscription.active) {
        try {
          await subscription.channel.unsubscribe();
          subscription.active = false;
          this.subscriptions.delete(channelName);
        } catch (err) {
          this.error = `Failed to unsubscribe from ${channelName}: ${err.message}`;
          throw err;
        }
      }
    },

    async disconnect() {
      if (this.client) {
        // 取消所有订阅
        for (const [channelName] of this.subscriptions) {
          await this.unsubscribe(channelName);
        }
        
        // 关闭连接
        await this.client.close();
        this.client = null;
        this.connectionState = 'disconnected';
      }
    },

    // 工具方法：生成channel名称
    getChannelName(type, id) {
      return `${type}:${id}`;
    }
  },
});