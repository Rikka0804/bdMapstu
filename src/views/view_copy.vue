<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import search from '@/assets/mapSearch.png'
import heat from '@/assets/heat.png'
import heatActive from '@/assets/heatActive.png'
import point from '@/assets/point.png'
import pointActive from '@/assets/pointActive.png'
// beijing数据
import beijingData from './beijing.json'
// 全市各区边界
import beijingBoundarySource from './beijingbj.json'
// mock 的街道边界数据。
import eastDistrictStreetBoundarySource from './qubj1.json'
// mock 的单街道边界数据。
import selectedStreetBoundarySource from './jiedaobj.json'

type BoundaryFeature = {
  // 边界名称。
  name: string
  // 行政区 id。
  relatedId: number
  // 坐标。
  coordinates: number[][][][]
  // 级别
  level: 'CITY' | 'COUNTY' | 'TOWN'
  // 企业数量。
  privateEnterpriseCount?: number
}

type BoundaryCollection = {
  // 区边界字段。
  mapData?: BoundaryFeature[]
  // 单街道边界字段。
  data?: BoundaryFeature[]
}

type PolygonInput = any[]

// 北京首页使用的区边界数据。
const districtBoundaryList = (beijingBoundarySource as BoundaryCollection).mapData ?? []
// 街道 mock 边界数据。
const streetBoundaryList = (eastDistrictStreetBoundarySource as BoundaryCollection).mapData ?? []
// 单街道 mock 边界数据。
const selectedStreetBoundaryList = (selectedStreetBoundarySource as BoundaryCollection).data ?? []
// 地理编码时统一使用的城市前缀。
const CITY_NAME = '北京市'

const options = ref(beijingData)

// 1. heat 热力 ponint点位
type Mode = 'heat' | 'point'

// 地图上所有可点击标签统一用这一种数据结构：
// 首页表示区，点区后表示街道。
type MapLabelItem = {
  id: number
  name: string
  // 中心点[经度, 纬度]
  center: [number, number]
  // 标签显示值。
  value: number
  // 地理编码关键字。
  keyword: string
  // 点击标签后聚焦的缩放级别。
  focusZoom: number
  // 区级标签时为空；街道标签时记录所属区，当前主要用于按区缓存街道列表。
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

// 页面里会动态增删三类覆盖物：
// 1. 地图边界
// 2. 点位图的文本标签
// 3. 搜索标记
type OverlayGroup = 'mapBoundary' | 'districtLabel' | 'searchMarker'


type BMapWindow = Window &
  typeof globalThis & {
    BMapGL?: any
    mapvgl?: any
    mapv?: any
  }


// 默认缩放级别
const DEFAULT_FOCUS_ZOOM = 10
// 点击区后的默认缩放级别。
const DEFAULT_DISTRICT_FOCUS_ZOOM = 13
// 点击街道后的默认缩放级别。
const DEFAULT_STREET_FOCUS_ZOOM = 15
// 当前页面统一使用的边界样式。
const DEFAULT_BOUNDARY_STYLE = {
  strokeColor: '#a88d8a',
  strokeWeight: 3,
  strokeOpacity: 0.96,
  fillColor: '#ccffe8',
  fillOpacity: 0.48,
  enableClicking: false
}
// 地图默认中心点和缩放级别。
const CITY_VIEW = ref({
  center: [0,0] as [number, number],
  zoom: DEFAULT_FOCUS_ZOOM
})

// 搜索按钮演示使用的固定点位。
const SEARCH_MARKER_POINT = [116.1485, 39.7598] as [number, number]

// 热力图刻度值。
const HEAT_SCALE = [0, 10000, 20000, 30000, 40000, 50000]

// 当前地图视角。
const cityView = ref({
  center: [...CITY_VIEW.value.center] as [number, number],
  zoom: CITY_VIEW.value.zoom
})
// 北京首页的区级标签数据，重置视图时会回到这里。
const rootLabelItems = ref<MapLabelItem[]>([])
// 当前标签数据。
const currentLabelItems = ref<MapLabelItem[]>([])
// 当前边界数据。
const currentBoundaryFeatures = ref<BoundaryFeature[]>(districtBoundaryList)
// 加载时 loading 
const isLocationLoading = ref(false)

// 热力图演示数据。
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

// 通过百度接口获取名称对应的中心点。
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

// loading 的异步函数。
// 把本地边界坐标转成百度地图 `Polygon` 可直接使用的数据。
const getPolygonInputsFromFeature = (feature?: BoundaryFeature | null) => {
  if (!feature?.coordinates?.length || !BMapGLRef) {
    return []
  }

  return feature.coordinates.map((polygon) => {
    const rings = polygon.map((ring) => ring.map(([lng, lat]) => new BMapGLRef.Point(lng, lat)))
    return rings.length === 1 ? rings[0] : rings
  })
}


// 区级标签使用的地理编码关键字。
const buildDistrictKeyword = (districtName: string) => `${CITY_NAME}${districtName}`
// 街道级标签使用的地理编码关键字。
const buildTownKeyword = (districtName: string, townName: string) => `${CITY_NAME}${districtName}${townName}`

// 用一份边界数据批量生成当前层级的标签数据。
const loadPointItems = async ({
  boundaries,
  buildKeyword,
}: {
  boundaries: BoundaryFeature[]
  buildKeyword: (name: string) => string
}) => {
  const items = await Promise.all(
    boundaries.map(async (boundary) => {
      try {
        const item: MapLabelItem = {
          id: boundary.relatedId,
          name: boundary.name,
          center: await fetchLocation(buildKeyword(boundary.name)),
          value: boundary.privateEnterpriseCount ?? 0,
          keyword: buildKeyword(boundary.name),
          focusZoom: boundary.level === 'CITY' ? DEFAULT_FOCUS_ZOOM:boundary.level === 'COUNTY' ? DEFAULT_DISTRICT_FOCUS_ZOOM : DEFAULT_STREET_FOCUS_ZOOM,
        }
        

        return item
      } catch {
        return null
      }
    })
  )

  return items.filter((item): item is MapLabelItem => item !== null)
}

// 地图挂载 DOM 容器。
const mapContainer = ref<HTMLDivElement | null>(null)

// 搜索框输入内容。
const searchKeyword = ref<number | undefined>()

// 当前显示热力图还是点位图。
const mode = ref<Mode>('point')

// 地图 SDK 和底图是否已经准备完毕。
const isMapReady = ref(false)


// 当前页面维护的覆盖物分组，方便统一删除和重绘。
const overlayGroups: Record<OverlayGroup, any[]> = {
  mapBoundary: [],
  districtLabel: [],
  searchMarker: []
}

// 当前选中的区名。
const activeDistrictName = ref('')
// 当前选中的街道名。

// 百度地图相关运行时实例。
let BMapGLRef: any = null
let mapvglRef: any = null
let map: any = null
let mapvglView: any = null
let heatmapLayer: any = null
// 边界重绘的版本号，避免异步结果回写旧状态。
let boundaryViewToken = 0

// 切换显示模式时同步刷新当前图层。
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
      // 初始化标签数据
      const visibleDistrictItems = await loadPointItems({
        boundaries: districtBoundaryList,
        buildKeyword: buildDistrictKeyword
      })
      let name
      if(beijingData.level === 'CITY') {
        name = CITY_NAME
      } else{
        name = CITY_NAME + beijingData.name
      }
      // 初始化中心点
      const rootCenter = await fetchLocation(name).catch(() => CITY_VIEW.value.center)
      // 判断默认权限
      const rootZoom = beijingData.level === 'CITY' ? DEFAULT_FOCUS_ZOOM : beijingData.level === 'COUNTY' ? DEFAULT_DISTRICT_FOCUS_ZOOM :DEFAULT_STREET_FOCUS_ZOOM

      cityView.value = {
        center: rootCenter,
        zoom: rootZoom
      }
      rootLabelItems.value = visibleDistrictItems
      currentLabelItems.value = visibleDistrictItems
      currentBoundaryFeatures.value = districtBoundaryList
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

// 轮询检查百度地图和 mapvgl 全局对象是否已经加载完成。
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

// 创建百度地图底图实例并设置基础交互。
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
  // map.setMaxZoom(15)
  map.setDisplayOptions?.({
    indoor: false,
    poiText: true,
    poiIcon: false
  })
  map.setTilt?.(0)
  map.setHeading?.(0)
}

// 确保 mapvgl 的 View 已经绑定到底图。
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

// 根据当前层级的数据源，整批重绘地图边界。
const refreshBoundaryView = async () => {
  const token = ++boundaryViewToken
  const boundaryFeatures = currentBoundaryFeatures.value

  if (token !== boundaryViewToken) {
    return
  }

  clearOverlayGroup('mapBoundary')

  if (!boundaryFeatures.length) {
    return
  }

  const polygonInputs = boundaryFeatures.reduce<PolygonInput[]>((allPolygons, feature) => {
    allPolygons.push(...getPolygonInputsFromFeature(feature))
    return allPolygons
  }, [])

  if (!polygonInputs.length) {
    return
  }

  overlayGroups.mapBoundary = polygonInputs.map((polygonInput: PolygonInput) =>
    createPolygon(polygonInput, DEFAULT_BOUNDARY_STYLE)
  )
}

// 创建一个多边形覆盖物并挂到地图上。
const createPolygon = (path: string | any[], options: Record<string, unknown>) => {
  if (!map || !BMapGLRef) {
    return null
  }

  // `Polygon` 是百度地图里的多边形覆盖物。
  // 行政区边界、本区域描边，通常都用它。
  const polygon = new BMapGLRef.Polygon(path, options)
  map.addOverlay(polygon)
  return polygon
}

// 清理某一组覆盖物。
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

// 清理当前页面所有地图图层和覆盖物。
const clearAllMapLayers = () => {
  clearOverlayGroup('mapBoundary')
  clearOverlayGroup('districtLabel')
  clearOverlayGroup('searchMarker')
  clearHeatmap()
}

// 清理热力图图层。
const clearHeatmap = () => {
  if (mapvglView && heatmapLayer) {
    try {
      heatmapLayer.setData([])
      mapvglView.removeLayer(heatmapLayer)
    } catch { }
  }

  heatmapLayer = null
}

// 根据当前模式决定显示热力图还是标签图。
const refreshVisibleLayers = () => {
  if (mode.value === 'heat') {
    clearOverlayGroup('districtLabel')
    renderHeatmap()
    return
  }

  clearHeatmap()
  renderDistrictLabels()
}


// 渲染热力图图层。
const renderHeatmap = () => {
  clearHeatmap()

  if (!mapvglView || !mapvglRef) {
    return
  }

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

// 渲染当前层级的标签覆盖物。
const renderDistrictLabels = () => {
  if (!map || !BMapGLRef) {
    return
  }

  clearOverlayGroup('districtLabel')

  if (mode.value !== 'point') {
    return
  }

  const pointItems = currentLabelItems.value

  pointItems.forEach((item) => {
    // `Label` 是百度地图自带的文本覆盖物。
    // 这里用它而不是 Marker，是因为当前主要想展示文字和值。
    const label = new BMapGLRef.Label(`${item.name} ${item.value}`, {
      position: new BMapGLRef.Point(...item.center),
      offset: new BMapGLRef.Size(-42, -18)
    })

    applyDistrictLabelStyle(label)

    label.addEventListener('click', () => {
      void focusItem(item)
    })

    map.addOverlay(label)
    overlayGroups.districtLabel.push(label)
  })
}

// 点击标签后的统一处理：
// 点区：切到街道层 mock 数据
// 点街道：切到单街道 mock 数据
const focusItem = async (item: MapLabelItem) => {
  if (!map || !BMapGLRef) {
    return
  }
  console.log(item);
  

  if (!activeDistrictName.value) {
    activeDistrictName.value = item.name

    isLocationLoading.value = true

    let nextItems: MapLabelItem[]
    try {
      //模拟点击东城区
      nextItems = await loadPointItems({
        boundaries: streetBoundaryList,
        buildKeyword: (name) => buildTownKeyword(item.name, name)
      })
    } finally {
      isLocationLoading.value = false
    }

    if (mode.value !== 'point') {
      return
    }

    currentLabelItems.value = nextItems
    currentBoundaryFeatures.value = streetBoundaryList

    map.centerAndZoom(new BMapGLRef.Point(...item.center), item.focusZoom)
    await refreshBoundaryView()
    renderDistrictLabels()
    return
  }

  const center = await fetchLocation(item.keyword).catch(() => item.center)

  if (mode.value !== 'point') {
    return
  }

  const selectedStreetBoundary = selectedStreetBoundaryList[0]
  currentBoundaryFeatures.value = selectedStreetBoundaryList
  currentLabelItems.value = [
    {
      ...item,
      value: selectedStreetBoundary?.privateEnterpriseCount ?? item.value
    }
  ]

  map.centerAndZoom(new BMapGLRef.Point(...center), item.focusZoom)
  await refreshBoundaryView()
  renderDistrictLabels()
}

// 标签样式。
const applyDistrictLabelStyle = (label: any) => {
  label.setStyle({
    minWidth: '84px',
    padding: '5px 12px',
    border: 'none',
    borderRadius: '999px',
    color: '#ffffff',
    background: 'linear-gradient(180deg,#ff6c77 0%,#f02736 100%)',
    boxShadow: '0 8px 14px rgba(255, 61, 89, 0.22)',
    fontSize: '14px',
    lineHeight: '1.2',
    textAlign: 'center',
    whiteSpace: 'nowrap'
  })
}

// 切换页面显示模式。
const restoreCityState = () => {
  activeDistrictName.value = ''
  currentBoundaryFeatures.value = districtBoundaryList
  currentLabelItems.value = rootLabelItems.value

  if (!map || !BMapGLRef) {
    return
  }

  map.centerAndZoom(new BMapGLRef.Point(...cityView.value.center), cityView.value.zoom)
  void refreshBoundaryView()
}

const setMode = (nextMode: Mode) => {
  if (mode.value === nextMode) {
    return
  }

  if (nextMode === 'heat') {
    restoreCityState()
    clearOverlayGroup('districtLabel')
    clearOverlayGroup('searchMarker')
  }

  mode.value = nextMode
}

// 返回北京首页视图，并恢复首页边界与标签。
const resetToCityView = () => {
  restoreCityState()
  renderDistrictLabels()
}

// 地图放大按钮。
const zoomIn = () => {
  map?.zoomIn?.()
}

// 地图缩小按钮。
const zoomOut = () => {
  map?.zoomOut?.()
}

// 搜索回车后的演示定位逻辑。
const handleSearchEnter = () => {
  if (!map || !BMapGLRef || searchKeyword.value == null) {
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

// 搜索定位点的 HTML 内容。
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
        <!-- <a-input v-model:value="searchKeyword" placeholder="请输入区/乡镇（街道）" @pressEnter="handleSearchEnter">
          <template #suffix>
            <img :src="search" alt="">
          </template>
        </a-input> -->
        <a-tree-select
          v-model:value="searchKeyword"
          :tree-data="[options]"
          :listHeight="650"
          :fieldNames="{
            children:'children', label:'name', value: 'idCode'
          }"
          placeholder="请输入区/乡镇（街道）"
          style="width: 100%">
          <template #suffixIcon>
            <img :src="search" alt="">
          </template>
        </a-tree-select>
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

  :deep(.ant-select) {
    width: 100%;
    height: 100%;
  }

  :deep(.ant-select-selector) {
    height: 100% !important;
    padding: 0 20px !important;
    border: 0 !important;
    outline: none !important;
    background: transparent !important;
    box-shadow: none !important;
    color: #2f3d39;
    font-size: 16px;
  }

  :deep(.ant-select-selection-search) {
    inset-inline-start: 20px !important;
    inset-inline-end: 52px !important;
  }

  :deep(.ant-select-selection-search-input),
  :deep(.ant-select-selection-item),
  :deep(.ant-select-selection-placeholder) {
    height: 48px !important;
    line-height: 48px !important;
    font-size: 16px;
  }

  :deep(.ant-select-selection-placeholder) {
    color: #c7c1c0;
  }

  :deep(.ant-select-arrow) {
    right: 20px;
    inset-inline-end: 20px;
    width: 24px;
    height: 24px;
    margin-top: -12px;
  }

  :deep(img) {
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
