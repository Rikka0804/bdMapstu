<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import search from '@/assets/mapSearch.png'
import heat from '@/assets/heat.png'
import heatActive from '@/assets/heatActive.png'
import point from '@/assets/point.png'
import pointActive from '@/assets/pointActive.png'
import allData from './beijing.json'

type AreaLevel = 'CITY' | 'COUNTY' | 'TOWN'

type AreaNode = {
  id: number
  name: string
  level: AreaLevel
  value?: number
  children?: AreaNode[]
}

const allDataList = allData as AreaNode
// 页面当前使用的数据根节点。后续如果切数据源，只需要切这个引用。
const currentDataList = ref<AreaNode>(allDataList)

// 1. heat 热力 ponint点位
type Mode = 'heat' | 'point'

// 每个行政区的基础信息。
type DistrictItem = {
  id: number
  // 行政区名字
  name: string
  // 区中心点。[经度, 纬度]
  center: [number, number]
  // 标签显示
  value: number
  keyword: string
  // 预留字段。按区聚焦
  focusZoom: number
}

type StreetItem = {
  id: number
  districtName: string
  name: string
  center: [number, number]
  value: number
  keyword: string
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

const CITY_VIEW = {
  center: [116.404, 39.915] as [number, number],
  zoom: 10
}
const DEFAULT_DISTRICT_FOCUS_ZOOM = 12

// 模拟搜索的点位
const SEARCH_MARKER_POINT = [116.1485, 39.7598] as [number, number]

// 热力图刻度值。
const HEAT_SCALE = [0, 10000, 20000, 30000, 40000, 50000]

// 点位图使用的派生数据，和原始权限树分开存，避免回写原数组。
const cityView = ref({
  center: [...CITY_VIEW.center] as [number, number],
  zoom: CITY_VIEW.zoom
})
const districtPointItems = ref<DistrictItem[]>([])
const streetPointItemsByDistrict = ref<Record<string, StreetItem[]>>({})
const isLocationLoading = ref(false)
// 地理编码缓存。相同关键字只请求一次，区和街道二次进入直接复用。
const locationCache = new Map<string, [number, number]>()

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

const getAreaValue = (node: AreaNode) => Number(node.value ?? 0)

// 对 `fetchLocation` 再包一层缓存，避免相同区域名重复调用地理编码接口。
const resolveLocation = async (keyword: string) => {
  const cachedLocation = locationCache.get(keyword)

  if (cachedLocation) {
    return cachedLocation
  }

  const location = await fetchLocation(keyword)
  locationCache.set(keyword, location)
  return location
}

// 顶层点位图只展示区一级节点。
const getCountyNodes = (rootNode: AreaNode) => {
  return (rootNode.children ?? []).filter((item) => item.level === 'COUNTY')
}

// 钻取后只展示当前区下的街道/乡镇节点。
const getTownNodes = (districtNode: AreaNode) => {
  return (districtNode.children ?? []).filter((item) => item.level === 'TOWN')
}

// 百度地理编码用完整行政区名字命中率更高，这里统一拼接查询关键字。
const buildDistrictKeyword = (rootNode: AreaNode, districtName: string) => {
  return `${rootNode.name}${districtName}`
}

// 街道中心点也使用完整路径关键字，减少重名乡镇带来的定位偏差。
const buildTownKeyword = (rootNode: AreaNode, districtName: string, townName: string) => {
  return `${rootNode.name}${districtName}${townName}`
}

const loadInitialPointItems = async () => {
  const rootNode = currentDataList.value
  const countyNodes = getCountyNodes(rootNode)

  const rootCenter = await resolveLocation(rootNode.name).catch(() => CITY_VIEW.center)
  const districtItems = await Promise.all(
    countyNodes.map(async (node) => {
      try {
        const districtItem: DistrictItem = {
          id: node.id,
          name: node.name,
          center: await resolveLocation(buildDistrictKeyword(rootNode, node.name)),
          value: getAreaValue(node),
          keyword: buildDistrictKeyword(rootNode, node.name),
          focusZoom: DEFAULT_DISTRICT_FOCUS_ZOOM
        }

        return districtItem
      } catch {
        return null
      }
    })
  )

  cityView.value = {
    center: rootCenter,
    zoom: CITY_VIEW.zoom
  }
  districtPointItems.value = districtItems.filter((item): item is DistrictItem => item !== null)
}

// 点进区时再懒加载街道中心点；如果第一条已有 center，说明之前取过，直接复用。
const ensureTownPointItems = async (districtName: string) => {
  const cachedItems = streetPointItemsByDistrict.value[districtName]

  if (cachedItems?.length === 0 || cachedItems?.[0]?.center) {
    return cachedItems ?? []
  }

  const rootNode = currentDataList.value
  const districtNode = getCountyNodes(rootNode).find((item) => item.name === districtName)

  if (!districtNode) {
    streetPointItemsByDistrict.value = {
      ...streetPointItemsByDistrict.value,
      [districtName]: []
    }
    return []
  }

  const townNodes = getTownNodes(districtNode)
  isLocationLoading.value = true

  let townItems: Array<StreetItem | null>
  try {
    townItems = await Promise.all(
      townNodes.map(async (node) => {
        try {
          const streetItem: StreetItem = {
            id: node.id,
            districtName,
            name: node.name,
            center: await resolveLocation(buildTownKeyword(rootNode, districtName, node.name)),
            value: getAreaValue(node),
            keyword: buildTownKeyword(rootNode, districtName, node.name)
          }

          return streetItem
        } catch {
          return null
        }
      })
    )
  } finally {
    isLocationLoading.value = false
  }

  const nextItems = townItems.filter((item): item is StreetItem => item !== null)
  streetPointItemsByDistrict.value = {
    ...streetPointItemsByDistrict.value,
    [districtName]: nextItems
  }

  return nextItems
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
    isLocationLoading.value = true
    try {
      await loadInitialPointItems()
    } finally {
      isLocationLoading.value = false
    }

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
  map.centerAndZoom(new BMapGLRef.Point(...cityView.value.center), cityView.value.zoom)
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
  const rootNode = currentDataList.value

  if (!activeDistrictName.value) {
    const [rootPaths, boundaryGroups] = await Promise.all([
      getBoundaryPaths(rootNode.name),
      Promise.all(districtPointItems.value.map((district) => getBoundaryPaths(buildDistrictKeyword(rootNode, district.name))))
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

  const selectedDistrictPaths = await getBoundaryPaths(buildDistrictKeyword(rootNode, activeDistrictName.value))

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

// 根据当前钻取层级返回应该展示在地图上的点位数据。
const getCurrentPointItems = (): Array<DistrictItem | StreetItem> => {
  if (!activeDistrictName.value) {
    return districtPointItems.value
  }

  return streetPointItemsByDistrict.value[activeDistrictName.value] ?? []
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
        void focusDistrict(item)
        return
      }

      focusStreet(item)
    })

    map.addOverlay(label)
    overlayGroups.districtLabel.push(label)
  })
}

// 先切到区视角，再按需拉街道中心点，避免未点击的区提前做无效请求。
const focusDistrict = async (district: DistrictItem) => {
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
  await ensureTownPointItems(district.name)

  if (activeDistrictName.value !== district.name) {
    return
  }

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

  map.centerAndZoom(new BMapGLRef.Point(...cityView.value.center), cityView.value.zoom)
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
      <div v-if="isLocationLoading" class="location-loading">
        <a-spin size="large" />
      </div>


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

.location-loading {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(237, 242, 235, 0.4);
  backdrop-filter: blur(2px);
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
