import Link from "next/link";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  className?: string;
  href?: string | null;
}

/**
 * HailScout wordmark — topographic mark + sans wordmark.
 *
 * The mark is a stylized contour-ring radar:
 *   • Outer ring (teal)         → the world
 *   • Middle ring (teal, thinner) → range
 *   • Inner ring (copper)       → the mark itself
 *   • Sweep arc (copper)        → the storm being charted
 *
 * Optionally animates a single radar pulse ring on the inner copper.
 */
export function Wordmark({ size = "md", pulse = false, className, href = "/" }: WordmarkProps) {
  const sizes = {
    sm: { mark: 22, text: "text-base"  },
    md: { mark: 28, text: "text-lg"    },
    lg: { mark: 40, text: "text-2xl"   },
  } as const;
  const s = sizes[size];

  const inner = (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <span className="relative inline-flex" style={{ width: s.mark, height: s.mark }}>
        <svg
          viewBox="0 0 28 28"
          width={s.mark}
          height={s.mark}
          className="text-primary"
          fill="none"
          aria-hidden
        >
          <circle cx="14" cy="14" r="11.5" stroke="currentColor" strokeWidth="1.1" opacity="0.9" />
          <circle cx="14" cy="14" r="7.75"  stroke="currentColor" strokeWidth="1"   opacity="0.7" />
          <circle cx="14" cy="14" r="4"     stroke="hsl(var(--copper-500))" strokeWidth="1.1" />
          <path d="M5 14 Q14 7 23 14" stroke="hsl(var(--copper-500))" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="14" cy="14" r="1.4" fill="hsl(var(--copper-500))" />
        </svg>
        {pulse && (
          <span
            className="radar-pulse pointer-events-none absolute inset-0 rounded-full border"
            style={{ borderColor: "hsl(var(--copper-500))" }}
          />
        )}
      </span>
      <span className={cn("font-display font-medium tracking-tight-display text-foreground", s.text)}>
        HailScout
      </span>
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex items-center" aria-label="HailScout home">
      {inner}
    </Link>
  );
}
