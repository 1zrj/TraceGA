export const mockEvents = [
  {
    id: '1',
    name: '用户登录',
    type: 'login',
    timestamp: '2024-01-15 10:30:00',
    properties: { device: 'mobile', platform: 'iOS' },
    userId: 'user001',
    sessionId: 'session001',
  },
  {
    id: '2',
    name: '商品浏览',
    type: 'view',
    timestamp: '2024-01-15 10:35:00',
    properties: { productId: 'prod001', category: 'electronics' },
    userId: 'user001',
    sessionId: 'session001',
  },
  {
    id: '3',
    name: '添加购物车',
    type: 'add_cart',
    timestamp: '2024-01-15 10:40:00',
    properties: { productId: 'prod001', quantity: 1 },
    userId: 'user001',
    sessionId: 'session001',
  },
  {
    id: '4',
    name: '用户注册',
    type: 'register',
    timestamp: '2024-01-15 11:00:00',
    properties: { channel: 'google' },
    userId: 'user002',
    sessionId: 'session002',
  },
  {
    id: '5',
    name: '订单完成',
    type: 'purchase',
    timestamp: '2024-01-15 11:30:00',
    properties: { orderId: 'order001', amount: 299.99 },
    userId: 'user001',
    sessionId: 'session001',
  },
]

export const mockOverview = {
  totalEvents: 12580,
  totalUsers: 3250,
  avgSessionDuration: 180,
  conversionRate: 4.5,
}

export const mockEventTrend = [
  { time: '01-09', count: 1200 },
  { time: '01-10', count: 1500 },
  { time: '01-11', count: 1300 },
  { time: '01-12', count: 1800 },
  { time: '01-13', count: 2100 },
  { time: '01-14', count: 1900 },
  { time: '01-15', count: 2200 },
]

export const mockTopEvents = [
  { name: '用户登录', count: 3500, percentage: 27.8 },
  { name: '商品浏览', count: 2800, percentage: 22.2 },
  { name: '添加购物车', count: 2100, percentage: 16.7 },
  { name: '订单完成', count: 1800, percentage: 14.3 },
  { name: '用户注册', count: 1500, percentage: 11.9 },
]