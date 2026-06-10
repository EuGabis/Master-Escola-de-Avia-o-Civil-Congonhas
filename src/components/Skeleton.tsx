import { cn } from "@/lib/cn";

/**
 * Bloco animado em shimmer pra placeholder de loading.
 * Trate como bloco visual: passe className com width/height/rounded.
 *
 * Ex:
 *   <Skeleton className="h-4 w-32 rounded" />
 *   <Skeleton className="h-11 w-11 rounded-full" />
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "animate-shimmer rounded-md bg-slate-200/40 dark:bg-slate-800/40",
        className
      )}
      aria-hidden="true"
    />
  );
}

/**
 * Linha tipica de lista (avatar + duas linhas de texto).
 * Usado pra placeholders de Conversas, Contatos, etc.
 */
export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-11 w-11 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-3.5 w-1/2 rounded" />
        <Skeleton className="h-3 w-3/4 rounded" />
      </div>
    </div>
  );
}

/**
 * Bloco de card vertical (titulo + linhas).
 */
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <Skeleton className="h-4 w-1/3 rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-3 rounded",
            i === rows - 1 ? "w-2/3" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Lista pronta com N itens — atalho para o uso mais comum.
 */
export function SkeletonList({ count = 6 }: { count?: number }) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}
