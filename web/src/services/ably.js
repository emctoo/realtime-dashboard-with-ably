import * as Ably from "ably";
import { ref } from 'vue';

// publish as message { data }
// data: {
//   fuel: 98.2
//   lap: 1
//   position: {x: 150, y: 217.5}
//   speed: 217.99842948152758
//   temp: 93.62958887471856
//   timestamp: 1730163902482
//   trackPosition: 66.33333333333334
// }

class AblyService {
    constructor() {
        this.client = null;
        this.connectionState = ref('disconnected');
        this.subscribedChannels = new Map();
        this.presenceData = ref(new Map());
        
        // 重连配置
        this.reconnectOptions = {
            maxRetryCount: 5,
            retryTimeout: 2000,
        };
    }

    // 初始化连接
    async initialize(apiKey) {
        try {
            this.client = new Ably.Realtime({
                key: apiKey,
                clientId: `user-${Math.random().toString(36).substr(2, 9)}`,
                recover: function(lastConnectionDetails, cb) {
                    cb(true); // 尝试恢复上一次连接
                }
            });

            // 连接状态监听
            this.client.connection.on('connected', () => {
                this.connectionState.value = 'connected';
                console.log('Connected to Ably');
                this.resubscribeAll(); // 重新订阅所有channel
            });

            this.client.connection.on('disconnected', () => {
                this.connectionState.value = 'disconnected';
                console.log('Disconnected from Ably');
                this.handleReconnection();
            });

            this.client.connection.on('failed', (error) => {
                this.connectionState.value = 'failed';
                console.error('Connection failed:', error);
            });

        } catch (error) {
            console.error('Ably initialization error:', error);
            throw error;
        }
    }

    // Channel命名规范
    getChannelName(type, id) {
        const channelTypes = {
            telemetry: `telemetry:${id}`,           // 遥测数据
            weather: `weather:${id}`,               // 天气数据
            race: `race:${id}`,                     // 比赛事件
            strategy: `strategy:${id}`,             // 策略更新
            presence: `presence:${id}`,             // 在线状态
        };

        return channelTypes[type] || `${type}:${id}`;
    }

    // 订阅channel
    async subscribeToChannel(channelName, callback, options = {}) {
        try {
            const channel = this.client.channels.get(channelName);
            
            // 错误处理
            channel.on('error', (error) => {
                console.error(`Channel ${channelName} error:`, error);
                this.handleChannelError(channelName, error);
            });

            // 如果需要presence功能
            if (options.presence) {
                this.setupPresence(channel);
            }

            // 订阅消息
            const subscription = await channel.subscribe((message) => {
                try {
                    callback(message);
                } catch (error) {
                    console.error('Message handling error:', error);
                }
            });

            // 存储订阅信息
            this.subscribedChannels.set(channelName, {
                channel,
                callback,
                options,
                subscription
            });

            return subscription;

        } catch (error) {
            console.error(`Subscribe to ${channelName} failed:`, error);
            throw error;
        }
    }

    // Presence功能设置
    setupPresence(channel) {
        channel.presence.subscribe('enter', (member) => {
            const currentMembers = this.presenceData.value.get(channel.name) || new Set();
            currentMembers.add(member.clientId);
            this.presenceData.value.set(channel.name, currentMembers);
        });

        channel.presence.subscribe('leave', (member) => {
            const currentMembers = this.presenceData.value.get(channel.name);
            if (currentMembers) {
                currentMembers.delete(member.clientId);
                this.presenceData.value.set(channel.name, currentMembers);
            }
        });

        // 获取当前在线成员
        channel.presence.get((err, members) => {
            if (!err) {
                const currentMembers = new Set(members.map(m => m.clientId));
                this.presenceData.value.set(channel.name, currentMembers);
            }
        });
    }

    // 重连逻辑
    async handleReconnection() {
        let retryCount = 0;
        
        const tryReconnect = async () => {
            if (retryCount >= this.reconnectOptions.maxRetryCount) {
                this.connectionState.value = 'failed';
                console.error('Max retry attempts reached');
                return;
            }

            try {
                await this.client.connect();
                console.log('Reconnected successfully');
            } catch (error) {
                console.error('Reconnection attempt failed:', error);
                retryCount++;
                setTimeout(tryReconnect, this.reconnectOptions.retryTimeout * Math.pow(2, retryCount));
            }
        };

        tryReconnect();
    }

    // Channel错误处理
    handleChannelError(channelName, error) {
        const subscription = this.subscribedChannels.get(channelName);
        if (subscription) {
            // 特定错误类型处理
            switch (error.code) {
                case 40142: // rate limit exceeded
                    this.handleRateLimitError(channelName);
                    break;
                case 40160: // channel operation failed
                    this.resubscribeChannel(channelName);
                    break;
                default:
                    console.error(`Unhandled channel error (${channelName}):`, error);
            }
        }
    }

    // 重新订阅所有channel
    async resubscribeAll() {
        for (const [channelName, details] of this.subscribedChannels) {
            await this.resubscribeChannel(channelName);
        }
    }

    // 重新订阅单个channel
    async resubscribeChannel(channelName) {
        const details = this.subscribedChannels.get(channelName);
        if (details) {
            try {
                await this.subscribeToChannel(channelName, details.callback, details.options);
                console.log(`Resubscribed to ${channelName}`);
            } catch (error) {
                console.error(`Failed to resubscribe to ${channelName}:`, error);
            }
        }
    }

    // 清理资源
    async disconnect() {
        if (this.client) {
            for (const [channelName, details] of this.subscribedChannels) {
                details.subscription.unsubscribe();
            }
            this.subscribedChannels.clear();
            await this.client.close();
            this.connectionState.value = 'disconnected';
        }
    }
}

// 创建单例
export const ablyService = new AblyService();