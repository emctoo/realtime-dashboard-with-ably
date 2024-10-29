<template>
    <div class="weather-widget text-white">
        <div class="grid gap-6">
            <!-- Track Temperature -->
            <div class="condition-item flex items-center gap-4">
                <div
                    class="icon-wrapper w-10 h-10 flex items-center justify-center rounded-lg bg-red-500/20"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        class="text-red-500"
                    >
                        <path
                            d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"
                        />
                    </svg>
                </div>
                <div class="info flex-1">
                    <div class="label text-sm text-gray-400">
                        Track Temperature
                    </div>
                    <div class="value text-lg font-medium">
                        {{ weather.trackTemp }}°C
                    </div>
                </div>
            </div>

            <!-- Humidity -->
            <div class="condition-item flex items-center gap-4">
                <div
                    class="icon-wrapper w-10 h-10 flex items-center justify-center rounded-lg bg-blue-500/20"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        class="text-blue-500"
                    >
                        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                    </svg>
                </div>
                <div class="info flex-1">
                    <div class="label text-sm text-gray-400">Humidity</div>
                    <div class="value text-lg font-medium">
                        {{ weather.humidity }}%
                    </div>
                </div>
            </div>

            <!-- Wind -->
            <div class="condition-item flex items-center gap-4">
                <div
                    class="icon-wrapper w-10 h-10 flex items-center justify-center rounded-lg bg-emerald-500/20"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        class="text-emerald-500"
                    >
                        <path
                            d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"
                        />
                    </svg>
                </div>
                <div class="info flex-1">
                    <div class="label text-sm text-gray-400">Wind</div>
                    <div class="value text-lg font-medium">
                        {{ weather.windSpeed }} km/h {{ weather.windDirection }}
                    </div>
                </div>
            </div>

            <!-- Rain Chance -->
            <div class="condition-item flex items-center gap-4">
                <div
                    class="icon-wrapper w-10 h-10 flex items-center justify-center rounded-lg bg-purple-500/20"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        class="text-purple-500"
                    >
                        <path
                            d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"
                        />
                        <path d="M16 14v6" />
                        <path d="M8 14v6" />
                        <path d="M12 16v6" />
                    </svg>
                </div>
                <div class="info flex-1">
                    <div class="label text-sm text-gray-400">Rain Chance</div>
                    <div class="value text-lg font-medium">
                        {{ weather.rainChance }}%
                    </div>
                </div>
            </div>
        </div>

        <!-- Track Status -->
        <div class="mt-6 p-4 rounded-lg" :class="trackStatusStyles">
            <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full" :class="statusDotColor"></div>
                <span class="font-medium"
                    >Track Status: {{ weather.trackStatus }}</span
                >
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
    weather: {
        type: Object,
        required: true,
        default: () => ({
            trackTemp: 0,
            humidity: 0,
            windSpeed: 0,
            windDirection: "N",
            rainChance: 0,
            trackStatus: "DRY",
        }),
    },
});

const trackStatusStyles = computed(() => {
    const styles = {
        DRY: "bg-green-500/20 text-green-400",
        WET: "bg-blue-500/20 text-blue-400",
        DAMP: "bg-yellow-500/20 text-yellow-400",
    };
    return styles[props.weather.trackStatus] || "bg-gray-500/20 text-gray-400";
});

const statusDotColor = computed(() => {
    const colors = {
        DRY: "bg-green-400",
        WET: "bg-blue-400",
        DAMP: "bg-yellow-400",
    };
    return colors[props.weather.trackStatus] || "bg-gray-400";
});
</script>
