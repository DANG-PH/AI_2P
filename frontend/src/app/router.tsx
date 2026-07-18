import { createBrowserRouter, redirect } from 'react-router'

import { RouteErrorBoundary } from '@/app/RouteErrorBoundary'
import LandingPage from '@/pages/LandingPage'
import { ROUTES } from '@/lib/constants'
import { createRoomId } from '@/lib/meetingIdentity'
import { useMeetingStore } from '@/store/meetingStore'

const redirectToRoom = (screen: 'setup' | 'meeting' | 'summary') => {
  const roomId = createRoomId()
  return redirect(ROUTES[screen](roomId))
}

const createMeeting = () => {
  useMeetingStore.getState().resetMeeting()
  return redirectToRoom('setup')
}

export const router = createBrowserRouter([
  {
    path: ROUTES.landing,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        Component: LandingPage,
      },
      {
        path: ROUTES.create,
        loader: createMeeting,
        element: <></>,
      },
      {
        path: '/room/:roomId/setup',
        lazy: async () => {
          const { default: Component } = await import(
            '@/pages/MeetingSetupPage'
          )
          return { Component }
        },
      },
      {
        path: '/room/:roomId/prejoin',
        lazy: async () => {
          const { default: Component } = await import(
            '@/pages/PreJoinPage'
          )
          return { Component }
        },
      },
      {
        path: '/room/:roomId',
        lazy: async () => {
          const { default: Component } = await import(
            '@/pages/LiveMeetingPage'
          )
          return { Component }
        },
      },
      {
        path: '/room/:roomId/summary',
        lazy: async () => {
          const { default: Component } = await import(
            '@/pages/MeetingSummaryPage'
          )
          return { Component }
        },
      },
      {
        path: '/setup',
        loader: () => redirectToRoom('setup'),
        element: <></>,
      },
      {
        path: '/meeting',
        loader: () => redirectToRoom('meeting'),
        element: <></>,
      },
      {
        path: '/summary',
        loader: () => redirectToRoom('summary'),
        element: <></>,
      },
    ],
  },
])
