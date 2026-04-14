<script setup lang="ts">
import { computed, ref } from 'vue'
import { BaiduMap, BmBoundary, BmLabel, BmlHeatmap } from 'vue-baidu-map-3x'
import search from '@/assets/mapSearch.png'
import heat from '@/assets/heat.png'
import heatActive from '@/assets/heatActive.png'
import point from '@/assets/point.png'
import pointActive from '@/assets/pointActive.png'

type Mode = 'heat' | 'point'

type DistrictItem = {
  name: string
  center: {
    lng: number
    lat: number
  }
  value: number
  focusZoom: number
}

type HeatmapPoint = {
  lng: number
  lat: number
  count: number
}

type MapReadyPayload = {
  BMap: any
  map: any
}

const MAP_AK = 'LUugoH0lcoGxcB25Je0WA9NA0FGEGQaV'

const CITY_VIEW = {
  center: {
    lng: 116.404,
    lat: 39.915
  },
  zoom: 10
}

const SEARCH_MARKER_POINT = {
  lng: 116.1485,
  lat: 39.7598
}

const DISTRICTS: DistrictItem[] = [
  { name: '东城区', center: { lng: 116.418, lat: 39.9288 }, value: 3221, focusZoom: 13 },
  { name: '西城区', center: { lng: 116.3668, lat: 39.9124 }, value: 2970, focusZoom: 13 },
  { name: '朝阳区', center: { lng: 116.4864, lat: 39.9215 }, value: 16917, focusZoom: 12 },
  { name: '海淀区', center: { lng: 116.2984, lat: 39.9593 }, value: 15285, focusZoom: 12 },
  { name: '丰台区', center: { lng: 116.2869, lat: 39.8585 }, value: 6148, focusZoom: 12 },
  { name: '石景山区', center: { lng: 116.223, lat: 39.9065 }, value: 1382, focusZoom: 12 },
  { name: '门头沟区', center: { lng: 116.103, lat: 39.9375 }, value: 382, focusZoom: 11 },
  { name: '房山区', center: { lng: 116.1435, lat: 39.7494 }, value: 1088, focusZoom: 11 },
  { name: '通州区', center: { lng: 116.663, lat: 39.9025 }, value: 2158, focusZoom: 11 },
  { name: '顺义区', center: { lng: 116.6542, lat: 40.1302 }, value: 2170, focusZoom: 11 },
  { name: '昌平区', center: { lng: 116.2312, lat: 40.2207 }, value: 2775, focusZoom: 11 },
  { name: '大兴区', center: { lng: 116.3415, lat: 39.7269 }, value: 1939, focusZoom: 11 },
  { name: '平谷区', center: { lng: 117.1214, lat: 40.1407 }, value: 320, focusZoom: 11 },
  { name: '怀柔区', center: { lng: 116.6371, lat: 40.3243 }, value: 536, focusZoom: 11 },
  { name: '密云区', center: { lng: 116.8434, lat: 40.3774 }, value: 646, focusZoom: 11 },
  { name: '延庆区', center: { lng: 115.985, lat: 40.462 }, value: 242, focusZoom: 11 }
]

const HEAT_POINTS: HeatmapPoint[] = [
  { lng: 116.221, lat: 39.873, count: 78 },
  { lng: 116.242, lat: 39.842, count: 98 },
  { lng: 116.258, lat: 39.791, count: 92 },
  { lng: 116.285, lat: 39.768, count: 86 },
  { lng: 116.305, lat: 39.824, count: 82 },
  { lng: 116.323, lat: 39.874, count: 90 },
  { lng: 116.341, lat: 39.845, count: 94 },
  { lng: 116.352, lat: 39.905, count: 96 },
  { lng: 116.367, lat: 39.872, count: 100 },
  { lng: 116.374, lat: 39.931, count: 93 },
  { lng: 116.395, lat: 39.896, count: 98 },
  { lng: 116.412, lat: 39.857, count: 96 },
  { lng: 116.428, lat: 39.822, count: 92 },
  { lng: 116.446, lat: 39.783, count: 100 },
  { lng: 116.452, lat: 39.733, count: 88 },
  { lng: 116.395, lat: 39.742, count: 72 },
  { lng: 116.344, lat: 39.716, count: 75 },
  { lng: 116.292, lat: 39.721, count: 68 },
  { lng: 116.266, lat: 39.879, count: 70 },
  { lng: 116.294, lat: 39.918, count: 76 },
  { lng: 116.319, lat: 39.952, count: 80 },
  { lng: 116.359, lat: 39.968, count: 84 },
  { lng: 116.418, lat: 39.952, count: 88 },
  { lng: 116.474, lat: 39.938, count: 95 },
  { lng: 116.506, lat: 39.886, count: 92 },
  { lng: 116.531, lat: 39.853, count: 90 },
  { lng: 116.563, lat: 39.825, count: 87 },
  { lng: 116.603, lat: 39.846, count: 76 },
  { lng: 116.584, lat: 39.901, count: 82 },
  { lng: 116.541, lat: 39.922, count: 78 },
  { lng: 116.493, lat: 39.995, count: 66 },
  { lng: 116.438, lat: 40.031, count: 62 },
  { lng: 116.335, lat: 40.061, count: 52 },
  { lng: 116.236, lat: 40.017, count: 48 },
  { lng: 116.211, lat: 39.957, count: 58 },
  { lng: 116.168, lat: 39.926, count: 34 },
  { lng: 116.147, lat: 39.882, count: 28 },
  { lng: 116.172, lat: 39.804, count: 32 },
  { lng: 116.213, lat: 39.744, count: 38 },
  { lng: 116.258, lat: 39.691, count: 43 },
  { lng: 116.315, lat: 39.668, count: 52 },
  { lng: 116.381, lat: 39.671, count: 58 },
  { lng: 116.468, lat: 39.691, count: 63 },
  { lng: 116.545, lat: 39.711, count: 56 },
  { lng: 116.622, lat: 39.776, count: 46 },
  { lng: 116.666, lat: 39.839, count: 52 },
  { lng: 116.707, lat: 39.901, count: 55 },
  { lng: 116.698, lat: 40.013, count: 42 },
  { lng: 116.621, lat: 40.104, count: 40 },
  { lng: 116.521, lat: 40.132, count: 36 },
  { lng: 116.415, lat: 40.187, count: 30 },
  { lng: 116.275, lat: 40.205, count: 28 },
  { lng: 116.104, lat: 40.214, count: 22 },
  { lng: 116.103, lat: 39.939, count: 24 },
  { lng: 116.438, lat: 40.368, count: 26 },
  { lng: 116.637, lat: 40.324, count: 28 },
  { lng: 116.844, lat: 40.378, count: 26 },
  { lng: 117.121, lat: 40.141, count: 20 },
  { lng: 116.081, lat: 39.579, count: 18 },
  { lng: 115.985, lat: 40.462, count: 18 }
]

const mode = ref<Mode>('point')
const center = ref({ ...CITY_VIEW.center })
const zoom = ref(CITY_VIEW.zoom)
const searchKeyword = ref('')
const activeDistrictName = ref('')
const searchMarkerVisible = ref(false)
const mapReady = ref(false)
const mapInstance = ref<any>(null)

const heatmapData = computed(() => (mode.value === 'heat' ? HEAT_POINTS : []))

const districtStyles = computed(() =>
  DISTRICTS.reduce<Record<string, Record<string, string>>>((styles, district) => {
    const isActive = district.name === activeDistrictName.value

    styles[district.name] = {
      minWidth: '84px',
      padding: '5px 12px',
      border: 'none',
      borderRadius: '999px',
      color: '#ffffff',
      background: isActive
        ? 'linear-gradient(180deg,#f54300 0%,#a0001a 100%)'
        : 'linear-gradient(180deg,#ff6c77 0%,#f02736 100%)',
      boxShadow: isActive
        ? '0 8px 16px rgba(160, 0, 26, 0.28)'
        : '0 8px 14px rgba(255, 61, 89, 0.22)',
      fontSize: '14px',
      lineHeight: '1.2',
      textAlign: 'center',
      whiteSpace: 'nowrap',
      opacity: mode.value === 'point' ? '1' : '0',
      pointerEvents: mode.value === 'point' ? 'auto' : 'none'
    }

    return styles
  }, {})
)

const searchLabelStyle = computed<Record<string, string>>(() => ({
  minWidth: '118px',
  padding: '6px 12px',
  border: 'none',
  borderRadius: '999px',
  background: '#2f6bff',
  color: '#ffffff',
  fontSize: '13px',
  lineHeight: '1.2',
  boxShadow: '0 8px 18px rgba(47, 107, 255, 0.24)',
  transform: 'translate(-50%, -145%)',
  opacity: searchMarkerVisible.value ? '1' : '0',
  pointerEvents: 'none'
}))

const searchLabelContent = computed(() => {
  const keyword = searchKeyword.value.trim()
  return keyword || '搜索定位点'
})

function handleReady({ BMap, map }: MapReadyPayload) {
  mapInstance.value = map
  mapReady.value = true

  ;(window as Window & { BMap?: any }).BMap = BMap

  map.setDisplayOptions?.({
    indoor: false,
    poiText: false,
    poiIcon: false
  })
  map.setTilt?.(0)
  map.setHeading?.(0)
  map.addEventListener?.('zoomend', syncView)
  map.addEventListener?.('moveend', syncView)
}

function syncView() {
  if (!mapInstance.value) {
    return
  }

  const currentCenter = mapInstance.value.getCenter?.()
  const currentZoom = mapInstance.value.getZoom?.()

  if (currentCenter) {
    center.value = {
      lng: currentCenter.lng,
      lat: currentCenter.lat
    }
  }

  if (typeof currentZoom === 'number') {
    zoom.value = currentZoom
  }
}

function setMode(nextMode: Mode) {
  mode.value = nextMode
}

function focusDistrict(district: DistrictItem) {
  activeDistrictName.value = district.name
  center.value = { ...district.center }
  zoom.value = district.focusZoom
}

function handleSearchEnter() {
  if (!searchKeyword.value.trim()) {
    return
  }

  searchMarkerVisible.value = true
  center.value = { ...SEARCH_MARKER_POINT }
  zoom.value = 13
}

function resetCityView() {
  activeDistrictName.value = ''
  searchMarkerVisible.value = false
  center.value = { ...CITY_VIEW.center }
  zoom.value = CITY_VIEW.zoom
}

function zoomIn() {
  mapInstance.value?.zoomIn?.()
}

function zoomOut() {
  mapInstance.value?.zoomOut?.()
}
</script>

<template>
  <div class="map-page">
    <div class="map-shell">
      <BaiduMap
        class="map-canvas"
        :ak="MAP_AK"
        type="WebGL"
        :center="center"
        :zoom="zoom"
        :min-zoom="8"
        :max-zoom="15"
        :map-click="false"
        :scroll-wheel-zoom="true"
        @ready="handleReady"
      >
        <BmBoundary
          name="北京市"
          stroke-color="#a88d8a"
          :stroke-weight="5"
          :stroke-opacity="0.96"
          fill-color="#ccffe8"
          :fill-opacity="0.48"
          :clicking="false"
        />

        <BmBoundary
          v-for="district in DISTRICTS"
          :key="district.name"
          :name="`北京市${district.name}`"
          stroke-color="#756a7e"
          :stroke-weight="1.2"
          :stroke-opacity="0.7"
          :fill-opacity="0"
          :clicking="false"
        />

        <BmlHeatmap
          :data="heatmapData"
          :max="100"
          :radius="32"
          :opacity="0.7"
          :gradient="{
            0.12: '#605cff',
            0.34: '#36f45d',
            0.62: '#eaf125',
            1: '#e73427'
          }"
        />

        <BmLabel
          v-for="district in DISTRICTS"
          :key="district.name"
          :content="`${district.name} ${district.value}`"
          :position="district.center"
          :offset="{ width: -42, height: -18 }"
          :label-style="districtStyles[district.name]"
          @click="focusDistrict(district)"
        />

        <BmLabel
          :content="searchLabelContent"
          :position="SEARCH_MARKER_POINT"
          :label-style="searchLabelStyle"
        />
      </BaiduMap>

      <div class="map-mask" />

      <div class="search-bar">
        <a-input v-model:value="searchKeyword" placeholder="请输入区/乡镇（街道）" @pressEnter="handleSearchEnter">
          <template #suffix>
            <img :src="search" alt="">
          </template>
        </a-input>
      </div>

      <div class="mode-toggle">
        <button :class="{ active: mode === 'heat' }" type="button" @click="setMode('heat')">
          <img :src="mode === 'heat' ? heatActive : heat" alt="">
          显示热力图
        </button>
        <button :class="{ active: mode === 'point' }" type="button" @click="setMode('point')">
          <img :src="mode === 'point' ? pointActive : point" alt="">
          显示点位图
        </button>
      </div>

      <div class="plugin-tip">
        <p>这一版按组件库来组织：边界、标签、热力图都交给插件组件管理。</p>
        <p>切换时不再做大块卸载，只改数据和样式，尽量避开库内部的更新问题。</p>
      </div>

      <div class="action-row">
        <button type="button" class="ghost-button" @click="resetCityView">回到北京市视角</button>
      </div>

      <div class="zoom-control">
        <button type="button" :disabled="!mapReady" @click="zoomIn">+</button>
        <button type="button" :disabled="!mapReady" @click="zoomOut">-</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.map-page {
  height: 100%;
  min-height: 0;
}

.map-shell {
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #edf2eb;
}

.map-canvas,
.map-mask {
  position: absolute;
  inset: 0;
}

.map-canvas {
  z-index: 0;
}

.map-mask {
  z-index: 1;
  background: rgba(229, 238, 226, 0.05);
  pointer-events: none;
}

.search-bar,
.mode-toggle,
.plugin-tip,
.zoom-control,
.action-row {
  position: absolute;
  z-index: 3;
}

.search-bar {
  top: 14px;
  left: 40px;
  width: 400px;
  height: 48px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 2px 8px rgba(91, 108, 102, 0.08);

  img {
    width: 24px;
    height: 24px;
  }
}

.mode-toggle {
  top: 12px;
  right: 14px;
  display: inline-flex;
  border: 1px solid rgba(238, 233, 231, 0.92);
  border-radius: 6px;
  background: #f2f2f2;

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 160px;
    height: 32px;
    border: 0;
    background: transparent;
    color: #b0afb1;
    font-size: 14px;
    cursor: pointer;

    + button {
      border-left: 1px solid rgba(238, 233, 231, 0.92);
    }

    &.active {
      color: #c8102e;
      background: #ffffff;
    }

    img {
      width: 16px;
      height: 18px;
      margin-right: 6px;
    }
  }
}

.plugin-tip {
  top: 72px;
  left: 40px;
  width: 390px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 4px 14px rgba(67, 84, 77, 0.08);
  color: #42514c;
  font-size: 13px;
  line-height: 1.5;

  p {
    margin: 0;
  }

  p + p {
    margin-top: 4px;
  }
}

.action-row {
  top: 160px;
  left: 40px;
}

.ghost-button {
  height: 34px;
  padding: 0 14px;
  border: 1px solid rgba(47, 107, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #2f6bff;
  font-size: 13px;
  cursor: pointer;
}

.zoom-control {
  left: 104px;
  bottom: 42px;
  display: flex;
  flex-direction: column;
  gap: 4px;

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid #ff5360;
    background: #ffffff;
    color: #ff5360;
    font-size: 28px;
    line-height: 1;
    cursor: pointer;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }
}
</style>
