export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-fg font-black text-sm">
        N
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent pulse-ring" />
      </span>
      <span className="text-lg font-bold tracking-tight">name that snippet</span>
    </div>
  );
}
