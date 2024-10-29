<template>
    <div class="leaderboard text-white">
        <div class="drivers-list">
            <div
                v-for="car in cars"
                :key="car.id"
                class="driver-row bg-[#1a1f2e]/50 border border-gray-800 backdrop-blur-sm mb-px cursor-pointer hover:bg-[#1a1f2e]/80"
                :class="{'border-l-4': car.id === selectedCar}"
                :style="{
                    borderLeftColor: car.id === selectedCar ? getTeamColor(car.team) : 'transparent'
                }"
                @click="$emit('select', car.id)"
            >
                <div class="p-2">
                    <div class="flex items-center gap-2">
                        <!-- Position and Team Color -->
                        <div class="flex items-center gap-1.5">
                            <div class="w-0.5 h-8" :style="{ backgroundColor: getTeamColor(car.team) }"></div>
                            <span class="text-base font-bold text-gray-400">{{ car.position }}</span>
                        </div>

                        <!-- Driver Info -->
                        <div class="flex-1">
                            <div class="font-medium text-sm">{{ car.driver }}</div>
                            <div class="text-xs text-gray-400" :class="car.gap === 0 ? 'text-green-500' : ''">
                                {{ formatGap(car.gap) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
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

defineEmits(['select']);

const getTeamColor = (team) => {
    const colors = {
        Mercedes: "#00D2BE",
        "Red Bull": "#0600EF",
        Ferrari: "#DC0000",
        McLaren: "#FF8700",
        Alpine: "#0090FF",
        AlphaTauri: "#2B4562",
        "Aston Martin": "#006F62",
        Williams: "#005AFF",
        "Alfa Romeo": "#900000",
        Haas: "#FFFFFF",
    };
    return colors[team] || "#FFFFFF";
};

const formatGap = (gap) => {
    if (gap === 0) return "LEADER";
    if (!gap) return "--";
    return `+${gap.toFixed(3)}s`;
};
</script>