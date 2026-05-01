"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Quote {
  body: string;
  name: string;
  role: string;
  initials: string;
}

const QUOTES: Quote[] = [
  {
    body:
      "HailScout is the difference between us showing up first and us showing up at all. Our team rolls before the storm passes.",
    name: "Marcus Holloway",
    role: "Owner — Holloway Roofing · Wichita, KS",
    initials: "MH",
  },
  {
    body:
      "We doubled our knock-rate in two months. The atlas + alert combo means our reps are at the right doors at the right time. Insurance adjusters started taking our reports without question.",
    name: "Tasha Reyes",
    role: "VP Sales — Cardinal Exteriors · DFW, TX",
    initials: "TR",
  },
  {
    body:
      "We used to pay $4k a year for HailTrace and still chase paper. HailScout costs less and the PDFs go straight from the truck to the homeowner. Frankly we cancelled the other tool the day we signed up.",
    name: "Eddie Vargas",
    role: "Operations Manager — Apex Roofing · Denver, CO",
    initials: "EV",
  },
];

export function TestimonialCarousel() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % QUOTES.length);
    }, 8000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused]);

  const q = QUOTES[idx];

  return (
    <section className="bg-background">
      <div
        className="container py-24 md:py-32"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <figure className="mx-auto max-w-3xl text-center">
          <blockquote
            key={idx}
            className="font-display text-balance text-3xl font-medium leading-snug tracking-tight-display text-foreground md:text-4xl animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            &ldquo;{q.body}&rdquo;
          </blockquote>

          <figcaption className="mt-8 flex items-center justify-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-copper/10 text-copper-700 text-sm font-medium ring-1 ring-copper/30">
              {q.initials}
            </span>
            <div className="text-left text-sm">
              <p className="font-medium text-foreground">{q.name}</p>
              <p className="text-muted-foreground">{q.role}</p>
            </div>
          </figcaption>

          {/* Dot navigation */}
          <div
            className="mt-8 flex items-center justify-center gap-2"
            role="tablist"
            aria-label="Choose testimonial"
          >
            {QUOTES.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === idx}
                aria-label={`Testimonial ${i + 1}`}
                onClick={() => setIdx(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === idx ? "w-8 bg-copper" : "w-1.5 bg-foreground/20 hover:bg-foreground/40",
                )}
              />
            ))}
          </div>
        </figure>
      </div>
    </section>
  );
}
