import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import VueBaiduMapView from '../views/VueBaiduMapView.vue'

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
    }
  ]
})

export default router
