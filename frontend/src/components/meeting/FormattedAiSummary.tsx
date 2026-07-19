export interface FormattedAiSummaryProps {
  content: string
  isStreaming?: boolean
}

export function FormattedAiSummary({
  content,
  isStreaming,
}: FormattedAiSummaryProps) {
  const lines = content.split('\n')

  return (
    <div className="space-y-3 font-sans text-ink">
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={idx} className="h-1" />

        if (trimmed.startsWith('# ')) {
          return (
            <h1
              key={idx}
              className="mt-2 border-b border-line pb-2 text-xl font-bold tracking-tight text-ink sm:text-2xl"
            >
              {trimmed.slice(2).trim()}
            </h1>
          )
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2
              key={idx}
              className="mt-6 flex items-center gap-2 rounded-lg border-l-4 border-primary bg-primary/5 px-3 py-2 text-base font-semibold text-primary sm:text-lg"
            >
              {trimmed.slice(3).trim()}
            </h2>
          )
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h3
              key={idx}
              className="mt-4 text-sm font-semibold text-ink sm:text-base"
            >
              {trimmed.slice(4).trim()}
            </h3>
          )
        }
        if (
          trimmed.startsWith('- ') ||
          trimmed.startsWith('* ') ||
          /^\d+\.\s/.test(trimmed)
        ) {
          const text = trimmed.replace(/^(-|\*|\d+\.)\s+/, '')
          return (
            <div
              key={idx}
              className="flex items-start gap-2.5 pl-2 text-sm leading-6 text-ink-soft sm:text-base"
            >
              <span className="mt-2 block size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="flex-1 break-words">{text}</span>
            </div>
          )
        }

        return (
          <p
            key={idx}
            className="text-sm leading-7 text-ink-soft sm:text-base"
          >
            {trimmed}
          </p>
        )
      })}
      {isStreaming && (
        <span className="inline-block h-4 w-2 animate-pulse rounded-sm bg-primary align-middle" />
      )}
    </div>
  )
}
