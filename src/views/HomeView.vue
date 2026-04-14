<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import search from '@/assets/mapSearch.png'
import heat from '@/assets/heat.png'
import heatActive from '@/assets/heatActive.png'
import point from '@/assets/point.png'
import pointActive from '@/assets/pointActive.png'
import quData from './qu.json'
import jiedaoData from './jiedao.json'
import allData from './beijing.json'

const quDataList = quData
const jiedaoDataList = jiedaoData
const allDataList = allData
// 1. heat 热力 ponint点位
type Mode = 'heat' | 'point'

// 每个行政区的基础信息。
type DistrictItem = {
  // 行政区名字
  name: string
  // 区中心点。[经度, 纬度]
  center: [number, number]
  // 标签显示
  value: number
  // 预留字段。按区聚焦
  focusZoom: number
}

type StreetItem = {
  districtName: string
  name: string
  center: [number, number]
  value: number
}


// 热力图坐标、权重值。
type HeatmapPoint = {
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: {
    count: number
  }
}

// 页面里会动态增删四类覆盖物：
// 1. 北京整市边界
// 2. 各区边界
// 3. 点位图的文本标签
// 4. 搜索标记
type OverlayGroup = 'cityBoundary' | 'districtBoundary' | 'districtLabel' | 'searchMarker'


type BMapWindow = Window &
  typeof globalThis & {
    BMapGL?: any
    mapvgl?: any
    mapv?: any
  }

// 中心点和缩放级别。
// 当前页面没有按区聚焦功能，所以地图始终从这个视角进入。
const CITY_VIEW = {
  center: [116.404, 39.915] as [number, number],
  zoom: 10
}

// 模拟搜索的点位
const SEARCH_MARKER_POINT = [116.1485, 39.7598] as [number, number]

// 热力图刻度值。
const HEAT_SCALE = [0, 10000, 20000, 30000, 40000, 50000]


//各个区数据
const DISTRICTS: DistrictItem[] = [
  { name: '东城区', center: [116.418, 39.9288], value: 3221, focusZoom: 13 },
  { name: '西城区', center: [116.3668, 39.9124], value: 2970, focusZoom: 13 },
  { name: '朝阳区', center: [116.4864, 39.9215], value: 16917, focusZoom: 12 },
  { name: '海淀区', center: [116.2984, 39.9593], value: 15285, focusZoom: 12 },
  { name: '丰台区', center: [116.2869, 39.8585], value: 6148, focusZoom: 12 },
  { name: '石景山区', center: [116.223, 39.9065], value: 1382, focusZoom: 12 },
  { name: '门头沟区', center: [116.103, 39.9375], value: 382, focusZoom: 11 },
  { name: '房山区', center: [116.1435, 39.7494], value: 1088, focusZoom: 11 },
  { name: '通州区', center: [116.663, 39.9025], value: 2158, focusZoom: 11 },
  { name: '顺义区', center: [116.6542, 40.1302], value: 2170, focusZoom: 11 },
  { name: '昌平区', center: [116.2312, 40.2207], value: 2775, focusZoom: 11 },
  { name: '大兴区', center: [116.3415, 39.7269], value: 1939, focusZoom: 11 },
  { name: '平谷区', center: [117.1214, 40.1407], value: 320, focusZoom: 11 },
  { name: '怀柔区', center: [116.6371, 40.3243], value: 536, focusZoom: 11 },
  { name: '密云区', center: [116.8434, 40.3774], value: 646, focusZoom: 11 },
  { name: '延庆区', center: [115.985, 40.462], value: 242, focusZoom: 11 }
]

const STREET_NAME_SUFFIXES = ['街道一', '街道二', '街道三', '街道四', '街道五', '街道六']
const STREET_CENTER_OFFSETS: [number, number][] = [
  [-0.018, 0.012],
  [0.015, 0.01],
  [-0.012, -0.012],
  [0.018, -0.008],
  [0.004, 0.02],
  [-0.02, -0.002]
]
const STREET_VALUE_RATIOS = [0.24, 0.2, 0.17, 0.15, 0.13, 0.11]

const STREET_DATA_BY_DISTRICT: Record<string, StreetItem[]> = DISTRICTS.reduce<Record<string, StreetItem[]>>(
  (result, district) => {
    result[district.name] = STREET_CENTER_OFFSETS.map(([lngOffset, latOffset], index) => ({
      districtName: district.name,
      name: `${district.name}${STREET_NAME_SUFFIXES[index]}`,
      center: [
        Number((district.center[0] + lngOffset).toFixed(6)),
        Number((district.center[1] + latOffset).toFixed(6))
      ],
      value: Math.max(1, Math.round(district.value * STREET_VALUE_RATIOS[index]))
    }))

    return result
  },
  {}
)

// 热力图模拟数据

const HEAT_BASE_POINTS: HeatmapPoint[] = [
  { geometry: { type: 'Point', coordinates: [116.221, 39.873] }, properties: { count: 78 } },
  { geometry: { type: 'Point', coordinates: [116.242, 39.842] }, properties: { count: 98 } },
  { geometry: { type: 'Point', coordinates: [116.258, 39.791] }, properties: { count: 92 } },
  { geometry: { type: 'Point', coordinates: [116.285, 39.768] }, properties: { count: 86 } },
  { geometry: { type: 'Point', coordinates: [116.305, 39.824] }, properties: { count: 82 } },
  { geometry: { type: 'Point', coordinates: [116.323, 39.874] }, properties: { count: 90 } },
  { geometry: { type: 'Point', coordinates: [116.341, 39.845] }, properties: { count: 94 } },
  { geometry: { type: 'Point', coordinates: [116.352, 39.905] }, properties: { count: 96 } },
  { geometry: { type: 'Point', coordinates: [116.367, 39.872] }, properties: { count: 100 } },
  { geometry: { type: 'Point', coordinates: [116.374, 39.931] }, properties: { count: 93 } },
  { geometry: { type: 'Point', coordinates: [116.395, 39.896] }, properties: { count: 98 } },
  { geometry: { type: 'Point', coordinates: [116.412, 39.857] }, properties: { count: 96 } },
  { geometry: { type: 'Point', coordinates: [116.428, 39.822] }, properties: { count: 92 } },
  { geometry: { type: 'Point', coordinates: [116.446, 39.783] }, properties: { count: 100 } },
  { geometry: { type: 'Point', coordinates: [116.452, 39.733] }, properties: { count: 88 } },
  { geometry: { type: 'Point', coordinates: [116.395, 39.742] }, properties: { count: 72 } },
  { geometry: { type: 'Point', coordinates: [116.344, 39.716] }, properties: { count: 75 } },
  { geometry: { type: 'Point', coordinates: [116.292, 39.721] }, properties: { count: 68 } },
  { geometry: { type: 'Point', coordinates: [116.266, 39.879] }, properties: { count: 70 } },
  { geometry: { type: 'Point', coordinates: [116.294, 39.918] }, properties: { count: 76 } },
  { geometry: { type: 'Point', coordinates: [116.319, 39.952] }, properties: { count: 80 } },
  { geometry: { type: 'Point', coordinates: [116.359, 39.968] }, properties: { count: 84 } },
  { geometry: { type: 'Point', coordinates: [116.418, 39.952] }, properties: { count: 88 } },
  { geometry: { type: 'Point', coordinates: [116.474, 39.938] }, properties: { count: 95 } },
  { geometry: { type: 'Point', coordinates: [116.506, 39.886] }, properties: { count: 92 } },
  { geometry: { type: 'Point', coordinates: [116.531, 39.853] }, properties: { count: 90 } },
  { geometry: { type: 'Point', coordinates: [116.563, 39.825] }, properties: { count: 87 } },
  { geometry: { type: 'Point', coordinates: [116.603, 39.846] }, properties: { count: 76 } },
  { geometry: { type: 'Point', coordinates: [116.584, 39.901] }, properties: { count: 82 } },
  { geometry: { type: 'Point', coordinates: [116.541, 39.922] }, properties: { count: 78 } },
  { geometry: { type: 'Point', coordinates: [116.493, 39.995] }, properties: { count: 66 } },
  { geometry: { type: 'Point', coordinates: [116.438, 40.031] }, properties: { count: 62 } },
  { geometry: { type: 'Point', coordinates: [116.335, 40.061] }, properties: { count: 52 } },
  { geometry: { type: 'Point', coordinates: [116.236, 40.017] }, properties: { count: 48 } },
  { geometry: { type: 'Point', coordinates: [116.211, 39.957] }, properties: { count: 58 } },
  { geometry: { type: 'Point', coordinates: [116.168, 39.926] }, properties: { count: 34 } },
  { geometry: { type: 'Point', coordinates: [116.147, 39.882] }, properties: { count: 28 } },
  { geometry: { type: 'Point', coordinates: [116.172, 39.804] }, properties: { count: 32 } },
  { geometry: { type: 'Point', coordinates: [116.213, 39.744] }, properties: { count: 38 } },
  { geometry: { type: 'Point', coordinates: [116.258, 39.691] }, properties: { count: 43 } },
  { geometry: { type: 'Point', coordinates: [116.315, 39.668] }, properties: { count: 52 } },
  { geometry: { type: 'Point', coordinates: [116.381, 39.671] }, properties: { count: 58 } },
  { geometry: { type: 'Point', coordinates: [116.468, 39.691] }, properties: { count: 63 } },
  { geometry: { type: 'Point', coordinates: [116.545, 39.711] }, properties: { count: 56 } },
  { geometry: { type: 'Point', coordinates: [116.622, 39.776] }, properties: { count: 46 } },
  { geometry: { type: 'Point', coordinates: [116.666, 39.839] }, properties: { count: 52 } },
  { geometry: { type: 'Point', coordinates: [116.707, 39.901] }, properties: { count: 55 } },
  { geometry: { type: 'Point', coordinates: [116.698, 40.013] }, properties: { count: 42 } },
  { geometry: { type: 'Point', coordinates: [116.621, 40.104] }, properties: { count: 40 } },
  { geometry: { type: 'Point', coordinates: [116.521, 40.132] }, properties: { count: 36 } },
  { geometry: { type: 'Point', coordinates: [116.415, 40.187] }, properties: { count: 30 } },
  { geometry: { type: 'Point', coordinates: [116.275, 40.205] }, properties: { count: 28 } },
  { geometry: { type: 'Point', coordinates: [116.104, 40.214] }, properties: { count: 22 } },
  { geometry: { type: 'Point', coordinates: [116.103, 39.939] }, properties: { count: 24 } },
  { geometry: { type: 'Point', coordinates: [116.438, 40.368] }, properties: { count: 26 } },
  { geometry: { type: 'Point', coordinates: [116.637, 40.324] }, properties: { count: 28 } },
  { geometry: { type: 'Point', coordinates: [116.844, 40.378] }, properties: { count: 26 } },
  { geometry: { type: 'Point', coordinates: [117.121, 40.141] }, properties: { count: 20 } },
  { geometry: { type: 'Point', coordinates: [116.081, 39.579] }, properties: { count: 18 } },
  { geometry: { type: 'Point', coordinates: [115.985, 40.462] }, properties: { count: 18 } }
]

 const fetchLocation = async (keyword: string) => {
  const url =
    `/baidu-map-api/geocoding/v3/?address=${encodeURIComponent(keyword)}` +
    `&output=json&ak=pcoZXzIJJYioSUIMKWX2wevsVE5m9fRw`

  const response = await fetch(url)
  const data = await response.json()

  if (data.status !== 0 || !data.result?.location) {
    throw new Error(`百度地理编码失败: ${keyword}`)
  }

  return [data.result.location.lng, data.result.location.lat] as [number, number]
}

// 地图挂载 DOM 容器。
const mapContainer = ref<HTMLDivElement | null>(null)

// 搜索框输入内容。
const searchKeyword = ref('')

// 当前显示热力图还是点位图。
const mode = ref<Mode>('point')

// 地图 SDK 和底图是否已经准备完毕。
const isMapReady = ref(false)


// 地图覆盖物，方便后面统一删除。
// 切换模式手动清理。
const overlayGroups: Record<OverlayGroup, any[]> = {
  cityBoundary: [],
  districtBoundary: [],
  districtLabel: [],
  searchMarker: []
}

// 点击区域的信息
const activeDistrictName = ref('')
const activeStreetName = ref('')

// 地图实例 
let BMapGLRef: any = null
let mapvglRef: any = null
let map: any = null
let mapvglView: any = null
let heatmapLayer: any = null
let boundaryViewToken = 0

// 监听 mode，切换图层
watch(mode, () => {
  if (!isMapReady.value) {
    return
  }

  refreshVisibleLayers()
})

onMounted(async () => {
  await nextTick()

  if (!mapContainer.value) {
    return
  }

  try {
    //等待百度地图相关全局对象就绪
    const libs = await waitForMapGlobals()
    BMapGLRef = libs.BMapGL
    mapvglRef = libs.mapvgl

    // 创建底图
    initMap()
    // 创建热力图依赖的 View
    await ensureMapvglView()
    // 绘制当前主体边界
    await refreshBoundaryView()

    isMapReady.value = true
    refreshVisibleLayers()
  } catch (error) {
  }
})

onUnmounted(() => {
  // 组件销毁时要自己清理地图资源。
  clearAllMapLayers()

  map = null
  BMapGLRef = null
  mapvglRef = null
  mapvglView = null
  heatmapLayer = null
  isMapReady.value = false
})

// 轮询检查 `BMapGL`、`mapvgl`、`mapv` 这几个全局对象是否就绪。
const waitForMapGlobals = (timeout = 15000) => {
  return new Promise<{ BMapGL: any; mapvgl: any }>((resolve, reject) => {
    const startedAt = Date.now()

    const check = () => {
      const win = window as BMapWindow

      if (win.BMapGL?.Map && win.mapvgl && win.mapv) {
        resolve({
          BMapGL: win.BMapGL,
          mapvgl: win.mapvgl
        })
        return
      }

      if (Date.now() - startedAt >= timeout) {
        reject(new Error('百度地图脚本加载超时，请检查 AK 或网络'))
        return
      }

      window.setTimeout(check, 120)
    }

    check()
  })
}

// 地图底图创建。
// 1. `centerAndZoom`：设置初始中心点和缩放级别
// 2. `enableScrollWheelZoom(true)`：允许鼠标滚轮缩放
// 3. `setDisplayOptions`：隐藏默认 POI，减少底图噪音
// 4. `setTilt(0)` / `setHeading(0)`：固定成正北朝上、无倾斜的 2D 视角
const initMap = () => {
  if (!mapContainer.value || !BMapGLRef) {
    return
  }

  map = new BMapGLRef.Map(mapContainer.value, {
    enableMapClick: false
  })
  map.centerAndZoom(new BMapGLRef.Point(...CITY_VIEW.center), CITY_VIEW.zoom)
  map.enableScrollWheelZoom(true)
  map.setMinZoom(8)
  map.setMaxZoom(15)
  map.setDisplayOptions?.({
    indoor: false,
    poiText: true,
    poiIcon: false
  })
  map.setTilt?.(0)
  map.setHeading?.(0)
}

// `mapvgl` 挂载热力图
const ensureMapvglView = () => {
  return new Promise<void>((resolve) => {
    if (mapvglView || !map || !mapvglRef) {
      resolve()
      return
    }

    const createView = () => {
      try {
        // `new mapvgl.View({ map })` 的含义：
        // 把一个可视化图层容器绑定到当前底图。
        if (!mapvglView) {
          mapvglView = new mapvglRef.View({ map })
        }
        return true
      } catch {
        return false
      }
    }

    if (createView()) {
      resolve()
      return
    }

    const handleLoaded = () => {
      map.removeEventListener('tilesloaded', handleLoaded)
      createView()
      resolve()
    }

    map.addEventListener('tilesloaded', handleLoaded)
  })
}

// `Boundary` 可以根据行政区名字返回边界路径。
// 例如：
// 1. `北京市`
// 2. `北京市朝阳区`
//
// 返回的 `boundaries` 本质上是一组路径字符串，
// 后面要再喂给 `new BMapGL.Polygon(...)` 才能真正画出来。
const getBoundaryPaths = (keyword: string) => {
  return new Promise<string[]>((resolve) => {
    if (!BMapGLRef?.Boundary) {
      resolve([])
      return
    }

    const boundary = new BMapGLRef.Boundary()
    boundary.get(keyword, (result: { boundaries?: string[] }) => {
      resolve(result.boundaries ?? [])
    })
  })
}

const refreshBoundaryView = async () => {
  const token = ++boundaryViewToken

  if (!activeDistrictName.value) {
    const [rootPaths, boundaryGroups] = await Promise.all([
      getBoundaryPaths('北京市'),
      Promise.all(DISTRICTS.map((district) => getBoundaryPaths(`北京市${district.name}`)))
    ])

    if (token !== boundaryViewToken) {
      return
    }

    clearOverlayGroup('cityBoundary')
    clearOverlayGroup('districtBoundary')

    overlayGroups.cityBoundary = rootPaths.map((path: string) =>
      createPolygon(path, {
        strokeColor: '#a88d8a',
        strokeWeight: 5,
        strokeOpacity: 0.96,
        fillColor: '#ccffe8',
        fillOpacity: 0.48,
        enableClicking: false
      })
    )

    overlayGroups.districtBoundary = boundaryGroups.reduce<any[]>((allPolygons, paths) => {
      paths.forEach((path) => {
        allPolygons.push(
          createPolygon(path, {
            strokeColor: '#756a7e',
            strokeWeight: 1.2,
            strokeOpacity: 0.7,
            fillOpacity: 0,
            enableClicking: false
          })
        )
      })

      return allPolygons
    }, [])

    return
  }

  const selectedDistrictPaths = await getBoundaryPaths(`北京市${activeDistrictName.value}`)

  if (token !== boundaryViewToken) {
    return
  }

  clearOverlayGroup('cityBoundary')
  clearOverlayGroup('districtBoundary')

  overlayGroups.cityBoundary = selectedDistrictPaths.map((path: string) =>
    createPolygon(path, {
      strokeColor: '#b84f5a',
      strokeWeight: 4,
      strokeOpacity: 0.96,
      fillColor: '#ffd9d9',
      fillOpacity: 0.42,
      enableClicking: false
    })
  )
}

const createPolygon = (path: string, options: Record<string, unknown>) => {
  if (!map || !BMapGLRef) {
    return null
  }

  // `Polygon` 是百度地图里的多边形覆盖物。
  // 行政区边界、本区域描边，通常都用它。
  const polygon = new BMapGLRef.Polygon(path, options)
  map.addOverlay(polygon)
  return polygon
}

const clearOverlayGroup = (name: OverlayGroup) => {
  if (!map) {
    overlayGroups[name] = []
    return
  }

  // 统一清理这一组里所有覆盖物，防止模式切换后旧图层叠在新图层上。
  overlayGroups[name].forEach((overlay) => {
    if (overlay) {
      map.removeOverlay(overlay)
    }
  })
  overlayGroups[name] = []
}

const clearAllMapLayers = () => {
  clearOverlayGroup('cityBoundary')
  clearOverlayGroup('districtBoundary')
  clearOverlayGroup('districtLabel')
  clearOverlayGroup('searchMarker')
  clearHeatmap()
}

const clearHeatmap = () => {
  if (mapvglView && heatmapLayer) {
    try {
      // 先清数据，再移除图层，兼容性比直接删更稳。
      heatmapLayer.setData([])
      mapvglView.removeLayer(heatmapLayer)
    } catch { }
  }

  heatmapLayer = null
}

const refreshVisibleLayers = () => {
  // 这两个模式是互斥的，所以切换时一定要清掉另一种模式留下的内容。
  if (mode.value === 'heat') {
    clearOverlayGroup('districtLabel')
    renderHeatmap()
    return
  }

  clearHeatmap()
  renderDistrictLabels()
}

const getCurrentPointItems = (): Array<DistrictItem | StreetItem> => {
  if (!activeDistrictName.value) {
    return DISTRICTS
  }

  return STREET_DATA_BY_DISTRICT[activeDistrictName.value] ?? []
}

const renderHeatmap = () => {
  clearHeatmap()

  if (!mapvglView || !mapvglRef) {
    return
  }
  
  

  // 这里按官方文档使用 `geometry + properties.count` 的数据格式。
  // 北京整市视角下用米做单位，热区半径更稳定。
  heatmapLayer = new mapvglRef.HeatmapLayer({
    size: 3600,
    max: 70,
    min: 0,
    unit: 'm',
    height: 0,
    gradient: {
      0.12: 'rgba(96, 92, 255, 0.58)',
      0.34: 'rgba(54, 244, 93, 0.72)',
      0.62: 'rgba(234, 241, 37, 0.86)',
      1: 'rgba(231, 52, 39, 0.94)'
    }
  })

  mapvglView.addLayer(heatmapLayer)
  heatmapLayer.setData(HEAT_BASE_POINTS)
}

const renderDistrictLabels = () => {
  if (!map || !BMapGLRef) {
    return
  }

  clearOverlayGroup('districtLabel')

  const pointItems = getCurrentPointItems()

  pointItems.forEach((item) => {
    // `Label` 是百度地图自带的文本覆盖物。
    // 这里用它而不是 Marker，是因为当前主要想展示文字和值。
    const label = new BMapGLRef.Label(`${item.name} ${item.value}`, {
      position: new BMapGLRef.Point(...item.center),
      offset: new BMapGLRef.Size(-42, -18)
    })

    applyDistrictLabelStyle(label, isPointItemActive(item))

    label.addEventListener('click', () => {
      if ('focusZoom' in item) {
        focusDistrict(item)
        return
      }

      focusStreet(item)
    })

    map.addOverlay(label)
    overlayGroups.districtLabel.push(label)
  })
}

const focusDistrict = (district: DistrictItem) => {
  activeDistrictName.value = district.name
  activeStreetName.value = ''

  if (!map || !BMapGLRef) {
    return
  }

  if (activeDistrictName.value !== district.name) {
    return
  }

  map.centerAndZoom(new BMapGLRef.Point(...district.center), district.focusZoom)
  void refreshBoundaryView()
  renderDistrictLabels()
}

const focusStreet = (street: StreetItem) => {
  activeStreetName.value = street.name
  refreshDistrictLabelStyles()
}

const refreshDistrictLabelStyles = () => {
  const pointItems = getCurrentPointItems()

  overlayGroups.districtLabel.forEach((label, index) => {
    const pointItem = pointItems[index]

    if (!label || !pointItem) {
      return
    }

    applyDistrictLabelStyle(label, isPointItemActive(pointItem))
  })
}

const isPointItemActive = (item: DistrictItem | StreetItem) => {
  if ('focusZoom' in item) {
    return item.name === activeDistrictName.value
  }

  return item.name === activeStreetName.value
}

const applyDistrictLabelStyle = (label: any, isActive: boolean) => {
  label.setStyle({
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
    whiteSpace: 'nowrap'
  })
}

const setMode = (nextMode: Mode) => {
  mode.value = nextMode
}

const resetToCityView = () => {
  activeDistrictName.value = ''
  activeStreetName.value = ''

  if (!map || !BMapGLRef) {
    return
  }

  map.centerAndZoom(new BMapGLRef.Point(...CITY_VIEW.center), CITY_VIEW.zoom)
  void refreshBoundaryView()
  renderDistrictLabels()
}

// 百度地图实例自带缩放方法，这里只是给页面按钮包一层。
const zoomIn = () => {
  map?.zoomIn?.()
}

const zoomOut = () => {
  map?.zoomOut?.()
}

const handleSearchEnter = () => {
  if (!map || !BMapGLRef || !searchKeyword.value.trim()) {
    return
  }

  clearOverlayGroup('searchMarker')

  const point = new BMapGLRef.Point(...SEARCH_MARKER_POINT)
  const marker = new BMapGLRef.Label(getSearchMarkerMarkup(), {
    position: point,
    offset: new BMapGLRef.Size(-14, -28)
  })

  marker.setStyle({
    border: 'none',
    background: 'transparent',
    padding: '0',
    boxShadow: 'none'
  })

  map.addOverlay(marker)
  overlayGroups.searchMarker.push(marker)
}

const getSearchMarkerMarkup = () => {
  return `
    <div style="width:28px;height:36px;display:flex;align-items:flex-start;justify-content:center; position:relative;">
      <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 35C14 35 25 24.91 25 16.12C25 9.43 20.08 4 14 4C7.92 4 3 9.43 3 16.12C3 24.91 14 35 14 35Z" fill="#2F6BFF"/>
        <circle cx="14" cy="16" r="5" fill="white"/>
      </svg>
    </div>
    <div class="bubble">
    111111111111
  </div>
    
  `
}

</script>

<template>
  <div class="map-page">
    <div class="map-shell">
      <div ref="mapContainer" class="map-canvas" />
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

      <div v-if="activeDistrictName" class="drill-bar">
        <span>{{ activeDistrictName }}</span>
        <button type="button" @click="resetToCityView">返回全市</button>
      </div>

      <div v-if="mode === 'heat'" class="heat-legend">
        <div class="heat-scale">
          <span v-for="value in HEAT_SCALE.slice().reverse()" :key="value">{{ value }}</span>
        </div>
        <div class="heat-gradient">
          <span class="heat-gradient__cap" />
          <span class="heat-gradient__bar" />
          <span class="heat-gradient__cap" />
        </div>
      </div>

      <div class="zoom-control">
        <button type="button" @click="zoomIn">+</button>
        <button type="button" @click="zoomOut">-</button>
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
}

.search-bar,
.mode-toggle,
.heat-legend,
.zoom-control {
  position: absolute;
  z-index: 3;
}

.search-bar {
  top: 14px;
  left: 40px;
  display: flex;
  width: 400px;
  height: 48px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 2px 8px rgba(91, 108, 102, 0.08);

  input {
    flex: 1;
    padding: 0 20px;
    border: 0;
    outline: none;
    background: transparent;
    color: #2f3d39;
    font-size: 16px;

    &::placeholder {
      color: #c7c1c0;
    }
  }

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

    +button {
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

.drill-bar {
  position: absolute;
  top: 56px;
  right: 14px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 4px 14px rgba(67, 84, 77, 0.08);
  color: #42514c;
  font-size: 13px;

  button {
    height: 28px;
    padding: 0 10px;
    border: 1px solid rgba(200, 16, 46, 0.18);
    border-radius: 999px;
    background: #ffffff;
    color: #c8102e;
    cursor: pointer;
  }
}

.heat-legend {
  left: 40px;
  bottom: 156px;
  display: flex;
  align-items: flex-end;
  gap: 14px;

  .heat-scale {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-end;
    height: 240px;
    color: #1f2625;
    font-size: 18px;
    line-height: 1;
  }

  .heat-gradient {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 42px;
    height: 240px;

    &__cap {
      width: 42px;
      height: 8px;
      background: #ff5360;
      border: 1px solid #ffffff;
      border-radius: 4px;
      box-sizing: border-box;
      flex-shrink: 0;
    }

    &__bar {
      width: 32px;
      flex: 1;
      background: linear-gradient(180deg, #ca3333 0%, #caf033 39.48%, #47fe47 59.24%, #8a82e5 100%);
    }
  }
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
  }
}

// @media (max-width: 768px) {
//   .search-bar {
//     left: 12px;
//     width: calc(100vw - 24px);
//   }
//
//   .mode-toggle {
//     top: 12px;
//     right: 12px;
//
//     button {
//       min-width: 120px;
//     }
//   }
//
//   .heat-legend {
//     left: 12px;
//     bottom: 120px;
//
//     .heat-scale {
//       font-size: 14px;
//     }
//
//     .heat-gradient {
//       height: 180px;
//     }
//   }
//
//   .zoom-control {
//     left: 12px;
//     bottom: 20px;
//   }
// }
</style>

<style>
.bubble {
  position: absolute;
  top: 50%;
  left: 100%;
  transform: translateY(-50%);
  margin-left: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  background: #2f6bff;
  color: #fff;
  font-size: 14px;
  white-space: nowrap;
}

/* 左侧小尖 */
.bubble::before {
  content: '';
  position: absolute;
  top: 50%;
  left: -6px;
  transform: translateY(-50%);
  
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 6px solid #2f6bff;
}
</style>
