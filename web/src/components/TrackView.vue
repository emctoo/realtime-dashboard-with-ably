<template>
  <div class="track-view w-full h-full bg-[#1a1f2e]/50 backdrop-blur-sm rounded-lg p-4">
    <svg viewBox="0 0 800 400" class="w-full h-full">
      <!-- 赛道外圈 -->
      <path
        :d="trackPath"
        fill="none"
        stroke="#2a3142"
        stroke-width="40"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      
      <!-- 赛道内圈 -->
      <path
        :d="trackPath"
        fill="none"
        stroke="#1a1f2e"
        stroke-width="38"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      
      <!-- 赛道中线 -->
      <path
        :d="trackPath"
        fill="none"
        stroke="#3a4255"
        stroke-width="2"
        stroke-dasharray="5,5"
      />

      <!-- 起点/终点线 -->
      <line
        x1="520"
        y1="340"
        x2="520"
        y2="300"
        stroke="white"
        stroke-width="4"
      />

      <!-- DRS 区域 -->
      <g class="drs-zones" stroke="#4CAF50" stroke-width="2">
        <path d="M 450,340 L 600,340" stroke-dasharray="4,4" />
        <path d="M 600,180 L 700,180" stroke-dasharray="4,4" />
      </g>

      <!-- 弯道编号 -->
      <g class="turn-numbers" fill="#3a4255" font-size="12">
        <text x="450" y="280">T1</text>
        <text x="380" y="240">T2</text>
        <text x="320" y="200">T3</text>
        <text x="250" y="140">T4</text>
        <text x="200" y="100">T5</text>
        <text x="150" y="160">T6</text>
        <text x="180" y="220">T7</text>
        <text x="270" y="260">T8</text>
        <text x="400" y="320">T9</text>
        <text x="500" y="360">T10</text>
      </g>

      <!-- 扇区标记 -->
      <g class="sectors" fill="#3a4255" font-size="10" opacity="0.6">
        <text x="600" y="380">Sector 1</text>
        <text x="300" y="100">Sector 2</text>
        <text x="150" y="280">Sector 3</text>
      </g>

      <!-- 车手位置标记 -->
      <template v-for="car in cars" :key="car.id">
        <g v-if="positions[car.id] !== undefined">
          <!-- 选中车手的光晕效果 -->
          <circle
            v-if="selectedCar === car.id"
            :cx="getPointPosition(positions[car.id]).x"
            :cy="getPointPosition(positions[car.id]).y"
            r="8"
            :fill="`${getTeamColor(car.team)}40`"
            class="animate-pulse"
          />
          <!-- 车手位置点 -->
          <circle
            :cx="getPointPosition(positions[car.id]).x"
            :cy="getPointPosition(positions[car.id]).y"
            r="5"
            :fill="getTeamColor(car.team)"
            :class="{'ring-2 ring-white/50': selectedCar === car.id}"
          />
          <!-- 车手编号 -->
          <text
            :x="getPointPosition(positions[car.id]).x + 8"
            :y="getPointPosition(positions[car.id]).y + 4"
            fill="white"
            font-size="12"
          >{{ car.number }}</text>
        </g>
      </template>
    </svg>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  cars: {
    type: Array,
    required: true,
  },
  selectedCar: {
    type: String,
    required: true,
  }
});

// Red Bull Ring 赛道路径
// M: Move, no lines
// L: Line
const trackPath = `
  M 520,320
  L 600,320
  Q 650,320 650,270
  L 650,200
  Q 650,150 600,150
  L 500,150
  Q 450,150 400,120
  L 300,90
  Q 250,80 200,100
  Q 150,120 150,170
  L 150,220
  Q 150,270 200,270
  L 300,270
  Q 350,270 350,320
  L 520,320
`;

const positions = ref({});
let updateInterval;

// 定义路径点数组，用于更准确的点位计算
const pathPoints = [
  { x: 520, y: 320 }, // 起点
  { x: 600, y: 320 }, // T1
  { x: 650, y: 270 }, // T2
  { x: 650, y: 200 }, // T3
  { x: 600, y: 150 }, // T4
  { x: 500, y: 150 }, // T5
  { x: 400, y: 120 }, // T6
  { x: 300, y: 90 },  // T7
  { x: 200, y: 100 }, // T8
  { x: 150, y: 170 }, // T9
  { x: 150, y: 220 }, // T10
  { x: 200, y: 270 }, // 返回直道
  { x: 300, y: 270 },
  { x: 350, y: 320 },
  { x: 520, y: 320 }  // 完成一圈
];

// 计算两点之间的距离
const distance = (p1, p2) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

// 计算总路径长度
const totalLength = (() => {
  let total = 0;
  for (let i = 1; i < pathPoints.length; i++) {
    total += distance(pathPoints[i-1], pathPoints[i]);
  }
  return total;
})();

// 获取赛道上的点位置
const getPointPosition = (percentage) => {
  const targetLength = (percentage / 100) * totalLength;
  let currentLength = 0;
  
  for (let i = 1; i < pathPoints.length; i++) {
    const segmentLength = distance(pathPoints[i-1], pathPoints[i]);
    if (currentLength + segmentLength >= targetLength) {
      const remainingLength = targetLength - currentLength;
      const ratio = remainingLength / segmentLength;
      return {
        x: pathPoints[i-1].x + (pathPoints[i].x - pathPoints[i-1].x) * ratio,
        y: pathPoints[i-1].y + (pathPoints[i].y - pathPoints[i-1].y) * ratio
      };
    }
    currentLength += segmentLength;
  }
  return pathPoints[0]; // 默认返回起点
};

// 车队颜色
const getTeamColor = (team) => {
  const colors = {
    'Mercedes': '#00D2BE',
    'Red Bull': '#0600EF',
    'Ferrari': '#DC0000',
    'McLaren': '#FF8700',
    'Alpine': '#0090FF',
    'AlphaTauri': '#2B4562',
    'Aston Martin': '#006F62',
    'Williams': '#005AFF',
    'Alfa Romeo': '#900000',
    'Haas': '#FFFFFF'
  };
  return colors[team] || '#FFFFFF';
};

// 更新车手位置
const updatePositions = () => {
  positions.value = { ...positions.value };
  props.cars.forEach(car => {
    const current = positions.value[car.id] || 0;
    let speed = 0.3; // 基础速度
    
    // 根据赛车位置添加变化
    if (car.position === 1) {
      speed += 0.1;
    } else if (car.position === 2) {
      speed += 0.08;
    } else if (car.position === 3) {
      speed += 0.05;
    }
    
    // 添加随机变化
    speed += (Math.random() - 0.5) * 0.1;
    
    let newPos = current + speed;
    if (newPos > 100) newPos = 0;
    positions.value[car.id] = newPos;
  });
};

onMounted(() => {
  updateInterval = setInterval(updatePositions, 100);
});

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});
</script>

<style scoped>
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>