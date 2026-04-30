import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  /** Use a paler tone (e.g. on white cards). */
  subtle?: boolean;
  rounded?: "sm" | "md" | "lg" | "full";
}

/**
 * Animated placeholder block. Defaults to a 1-line text skeleton.
 * Shimmer is implemented as a CSS-only gradient sweep.
 */
export function Skeleton({
  className,
  style,
  width,
  height,
  subtle,
  rounded = "md",
  ...rest
}: SkeletonProps) {
  const radii: Record<string, string> = {
    sm: "rounded",
    md: "rounded-md",
    lg: "rounded-lg",
    full: "rounded-full",
  };
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden",
        subtle ? "bg-foreground/5" : "bg-secondary/70",
        radii[rounded],
        className,
      )}
      style={{
        width,
        height: height ?? "0.85em",
        ...style,
      }}
      {...rest}
    >
      <div
        className="absolute inset-0 -translate-x-full"
        style={{
          background:
            "linear-gradient(90deg, transparent, hsl(var(--foreground) / 0.06), transparent)",
          animation: "skeleton-shimmer 1.4s ease-in-out infinite",
        }}
      />
      <style jsx>{`
        @keyframes skeleton-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%);  }
        }
      `}</style>
    </div>
  );
}

/**
 * Common composed shapes for our pages.
 */
export function SkeletonRow({ withBadge = true }: { withBadge?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3">
      {withBadge && <Skeleton width={48} height={36} rounded="md" />}
      <div className="flex-1 space-y-2">
        <Skeleton width="60%" height={12} />
        <Skeleton width="35%" height={10} subtle />
      </div>
      <Skeleton width={60} height={10} subtle />
    </div>
  );
}

export function SkeletonCard({ height = 100 }: { height?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <Skeleton width="40%" height={10} />
      <Skeleton width="80%" height={28} />
      <Skeleton width="55%" height={10} subtle />
    </div>
  );
}
