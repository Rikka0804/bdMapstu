import permissionTreeRaw from './mock-permissions.json'

export type AreaLevel = 'CITY' | 'COUNTY' | 'TOWN'

export type AreaNode = {
  id: number
  name: string
  parentId: number
  level: AreaLevel
  idCode: number
  areaType: string | null
  sortNo: number
  children: AreaNode[]
  cityNum: number
  distinguishNum: number
  streetNum: number
  privateEnterpriseNum: number
}

export type MockProfileId = 'beijing_all' | 'dongcheng_only'

export type MockProfile = {
  id: MockProfileId
  name: string
  root: AreaNode
  rootKeyword: string
  initialZoom: number
}

const permissionTree = permissionTreeRaw as AreaNode

const cloneAreaNode = (node: AreaNode): AreaNode => ({
  ...node,
  children: node.children.map(cloneAreaNode)
})

const dongchengNode = permissionTree.children.find((item) => item.name === '东城区')

if (!dongchengNode) {
  throw new Error('mock-permissions.json 中缺少东城区数据')
}

export const mockProfiles: Record<MockProfileId, MockProfile> = {
  beijing_all: {
    id: 'beijing_all',
    name: '全市',
    root: cloneAreaNode(permissionTree),
    rootKeyword: '北京市',
    initialZoom: 10
  },
  dongcheng_only: {
    id: 'dongcheng_only',
    name: '东城区',
    root: cloneAreaNode(dongchengNode),
    rootKeyword: '北京市东城区',
    initialZoom: 13
  }
}

export const defaultMockProfileId: MockProfileId = 'beijing_all'
