import { createBrowserRouter } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { HomePage } from '@/pages/Home'
import { EventList } from '@/features/event-management/pages/EventList'
import { Dashboard } from '@/features/dashboard/pages/Dashboard'

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        path: '/',
        element: <HomePage />,
      },
      {
        path: '/event-management',
        element: <EventList />,
      },
      {
        path: '/dashboard',
        element: <Dashboard />,
      },
    ],
  },
])

export { router }
export default router