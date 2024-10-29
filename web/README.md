# Vue 3 + Vite

[design](../design1.jpg)

project structure:

```txt
src/
├── components/
|    |── Dashboard.vue         # 主仪表盘页面
│   ├── TelemetryChart.vue    # 遥测数据图表
│   ├── WeatherWidget.vue     # 天气信息组件
│   ├── RaceEvents.vue        # 比赛事件日志
│   ├── CarSelector.vue       # 赛车选择器
│   └── TrackInfo.vue         # 赛道信息
├── services/
│   ├── ably.js              # Ably 客户端配置
│   └── api.js               # API 调用
├── store/
│   └── index.js             # Vuex store
```
