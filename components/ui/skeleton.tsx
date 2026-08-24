import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "before:absolute before:inset-0 before:bg-gradient-to-r",
        "before:from-transparent before:via-white/30 before:to-transparent",
        "before:animate-shimmer before:[background-size:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-6 space-y-3", className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}
