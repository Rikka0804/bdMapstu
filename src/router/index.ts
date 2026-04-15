import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import VueBaiduMapView from '../views/VueBaiduMapView.vue'
import VueBaiduMapView2 from '../views/view_copy.vue'
import VueBaiduMapViewQuOnly from '../views/view_qu_only.vue'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/vue-baidu-map',
      name: 'vue-baidu-map',
      component: VueBaiduMapView
    },
     {
      path: '/vue-baidu-map2',
      name: 'vue-baidu-map2',
      component: VueBaiduMapView2
    },
    {
      path: '/vue-baidu-map-qu-only',
      name: 'vue-baidu-map-qu-only',
      component: VueBaiduMapViewQuOnly
    }
  ]
})

export default router
