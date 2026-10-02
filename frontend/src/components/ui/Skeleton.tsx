interface PropsSkeleton {
  className?: string
}

export function Skeleton({ className = 'h-4 w-full' }: PropsSkeleton) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} aria-hidden="true" />
}

export function SkeletonLinhas({ linhas = 5, colunas = 4 }: { linhas?: number; colunas?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Carregando">
      {Array.from({ length: linhas }).map((_, indiceLinha) => (
        <div key={indiceLinha} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
          {Array.from({ length: colunas }).map((_, indiceColuna) => (
            <Skeleton key={indiceColuna} className="h-5" />
          ))}
        </div>
      ))}
    </div>
  )
}
