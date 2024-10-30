import { defineStore } from 'pinia';
import * as Ably from "ably";
import axios from 'axios';

export const useAblyStore = defineStore('ably', {
  state: () => ({
    client: null,
    connectionState: 'disconnected',
    error: null,
    subscriptions: new Map(), // 跟踪所有活跃的订阅
    clientId: null, // 存储当前client ID
  }),

  getters: {
    isConnected: (state) => state.connectionState === 'connected',
    getSubscription: (state) => (channelName) => state.subscriptions.get(channelName),
  },

  actions: {
    async getAnonymousTokenRequest() {
      try {
        console.log('getting anonymous token request ...');
        const response = await axios.get('/api/anonymous-token');
        return {
          tokenRequest: response.data.ably_token,
          clientId: response.data.client_id
        };
      } catch (err) {
        console.error('Failed to get anonymous token request:', err);
        throw new Error('Failed to get anonymous token request');
      }
    },

    async initialize() {
      console.log('init ably store ...')
      try {
        // 如果已经有client，先关闭
        if (this.client) {
          await this.disconnect();
          console.log('disconnected existing client');
        }

        // 获取初始的token request
        const { tokenRequest, clientId } = await this.getAnonymousTokenRequest();
        this.clientId = clientId;

        // 创建新的Ably客户端        
        this.client = new Ably.Realtime({
          authCallback: async (tokenParams, callback) => {
            try {
              // 当需要新token时，获取新的token request
              const { tokenRequest } = await this.getAnonymousTokenRequest();
              callback(null, tokenRequest);
            } catch (err) {
              callback(err, null);
            }
          },
          // clientId: this.clientId,
          // 使用初始token request
          // authData: tokenRequest
        });

        // 监听连接状态变化
        this.client.connection.on('connected', () => {
          console.log('connected with clientId:', this.client.auth.clientId);
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

        this.client.connection.on('update', (stateChange) => {
          console.log('connection state updated:', stateChange);
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
        console.error('Failed to initialize Ably:', err);
        this.error = err.message;
        throw err;
      }
    },

    async updateAuthData(tokenRequest) {
      if (!this.client) {
        throw new Error('Ably client not initialized');
      }

      console.dir(tokenRequest);
      try {
        // 从 tokenRequest 提取需要的参数
        const tokenParams = {
          keyName: tokenRequest.keyName,
          timestamp: tokenRequest.timestamp,
          nonce: tokenRequest.nonce,          
          capability: tokenRequest.capability,
          clientId: tokenRequest.clientId
        };

        // 使用token params更新授权        
        console.dir(tokenParams);
        const tokenDetails = await this.client.auth.authorize(tokenParams);        
        
        console.log('Successfully updated auth with new token details:', tokenDetails);
        return tokenDetails;
      } catch (err) {
        console.error('Failed to update auth:', err);
        this.error = `Failed to update auth: ${err.message}`;
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
        this.clientId = null;
      }
    },

    // 工具方法：生成channel名称
    getChannelName(type, id) {
      return `${type}:${id}`;
    }
  },
});