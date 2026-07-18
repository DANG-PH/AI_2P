import { House, RefreshCw, TriangleAlert } from 'lucide-react'
import {
  isRouteErrorResponse,
  useRouteError,
} from 'react-router'

import { Button } from '@/components/ui/Button'
import { useTranslation } from '@/hooks/useTranslation'
import { ROUTES } from '@/lib/constants'

const getErrorDetails = (error: unknown) => {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`.trim()
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }

  return String(error)
}

export function RouteErrorBoundary() {
  const error = useRouteError()
  const { t } = useTranslation()
  const errorDetails = getErrorDetails(error)

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center px-4 sm:px-6 lg:px-8">
          <a
            href={ROUTES.landing}
            aria-label={t('nav.home')}
            className="inline-flex items-center gap-2.5"
          >
            <img
              aria-hidden="true"
              alt=""
              className="size-8 shrink-0 object-contain"
              src="/icon-512.png"
            />
            <span className="text-lg font-bold tracking-[-0.045em]">
              <span className="text-primary">Vi</span>
              <span className="text-vietnamese">En</span>
              <span className="text-ink">Meet</span>
            </span>
          </a>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-5xl place-items-center px-4 py-12 sm:px-6 lg:px-8">
        <section
          aria-labelledby="route-error-title"
          className="w-full max-w-2xl border-y border-line py-10 sm:py-12"
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-danger">
            <TriangleAlert aria-hidden="true" className="size-4" />
            {t('appError.eyebrow')}
          </div>

          <h1
            id="route-error-title"
            className="mt-5 max-w-xl text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.045em] text-ink"
          >
            {t('appError.title')}
          </h1>

          <p className="mt-5 max-w-xl text-base leading-7 text-muted-strong">
            {t('appError.description')}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="primary"
              size="lg"
              leadingIcon={
                <RefreshCw aria-hidden="true" className="size-4" />
              }
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto"
            >
              {t('appError.reload')}
            </Button>
            <a
              href={ROUTES.landing}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-panel px-5 text-sm font-semibold tracking-[-0.01em] text-ink transition-colors hover:border-muted hover:bg-panel-raised sm:w-auto"
            >
              <House aria-hidden="true" className="size-4" />
              {t('appError.home')}
            </a>
          </div>

          {import.meta.env.DEV && errorDetails ? (
            <details className="mt-8 border-t border-line pt-5">
              <summary className="w-fit cursor-pointer text-sm font-semibold text-muted-strong">
                {t('appError.details')}
              </summary>
              <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-[10px] bg-panel-muted p-4 text-xs leading-5 text-muted-strong">
                {errorDetails}
              </pre>
            </details>
          ) : null}
        </section>
      </main>
    </div>
  )
}
