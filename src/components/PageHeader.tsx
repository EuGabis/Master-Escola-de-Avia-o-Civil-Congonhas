export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">
          {title}
        </h1>
        {description && (
          <p className="text-slate-500 text-sm mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-master-orange/10 text-master-orange flex items-center justify-center mx-auto">
        <Icon size={28} />
      </div>
      <h2 className="font-semibold text-slate-900 dark:text-white mt-4 text-lg">
        {title}
      </h2>
      <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{description}</p>
      <span className="inline-block mt-4 text-xs uppercase tracking-wider bg-master-orange/10 text-master-orange px-3 py-1 rounded-full font-medium">
        Em breve
      </span>
    </div>
  );
}
