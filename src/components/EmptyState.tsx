import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Estado vazio padronizado: ilustracao circular + titulo + descricao curta
 * + acao opcional. Substitui textos soltos tipo "Nenhum resultado".
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-10 px-6 animate-fade-in",
        className
      )}
    >
      {icon && (
        <div className="relative mb-4">
          {/* Halo decorativo */}
          <div className="absolute inset-0 -m-2 rounded-full bg-master-orange/5 blur-md" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-master-orange/10 to-master-orange/5 border border-master-orange/20 flex items-center justify-center text-master-orange">
            {icon}
          </div>
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-[280px]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Avião pequeno decolando — combina com o tema da Master e
 * funciona bem no halo do EmptyState. 24px default.
 */
export function PlaneIllustration({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.6}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
}
