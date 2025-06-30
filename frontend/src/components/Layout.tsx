import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import { useEffect } from 'react'
import { wsService } from '../services/websocket'
import { useAuthStore } from '../stores/authStore'

export default function Layout() {
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      wsService.connect()
    }

    return () => {
      wsService.disconnect()
    }
  }, [isAuthenticated])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}