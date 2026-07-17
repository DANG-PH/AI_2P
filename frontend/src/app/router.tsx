import { createBrowserRouter } from 'react-router'

import LandingPage from '@/pages/LandingPage'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: LandingPage,
  },
  {
    path: '/setup',
    lazy: async () => {
      const { default: Component } = await import(
        '@/pages/MeetingSetupPage'
      )
      return { Component }
    },
  },
  {
    path: '/meeting',
    lazy: async () => {
      const { default: Component } = await import(
        '@/pages/LiveMeetingPage'
      )
      return { Component }
    },
  },
  {
    path: '/summary',
    lazy: async () => {
      const { default: Component } = await import(
        '@/pages/MeetingSummaryPage'
      )
      return { Component }
    },
  },
])
