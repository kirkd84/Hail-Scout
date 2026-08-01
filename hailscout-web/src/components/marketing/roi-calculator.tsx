"use client";

import { useState, useMemo } from "react";
import { SectionHeading } from "@/components/marketing/primitives";

/**
 * ROI calculator — gives prospects a concrete number to anchor on.
 * Inputs: crew size, avg ticket, close-rate lift.
 * Output: projected annual revenue lift + ROI multiple + payback time.
 *
 * Styled as an instrument: mono/tabular numerals for every readout,
 * .slider-touch inputs (44px hit area), rounded-xl card, honest
 * methodology note kept verbatim. The math is unchanged.
 */
export function RoiCalculator() {
  const [crew, setCrew] = useState(4);
  const [ticket, setTicket] = useState(14000);
  const [liftPct, setLiftPct] = useState(15);

  const calc = useMemo(() => {
    const incrementalDoorsPerRepPerMonth = 25;
    const baselineCloseRate = 0.06;
    const liftedClose = baselineCloseRate * (1 + liftPct / 100);
    const annualIncrementalDoors = crew * incrementalDoorsPerRepPerMonth * 12;
    const baselineDeals = annualIncrementalDoors * baselineCloseRate;
    const liftedDeals = annualIncrementalDoors * liftedClose;
    const incrementalDeals = liftedDeals - baselineDeals;
    const incrementalRevenue = incrementalDeals * ticket;
    const cost = 899;
    const roi = incrementalRevenue / cost;
    const paybackDays = (cost / incrementalRevenue) * 365;
    return { annualIncrementalDoors, incrementalDeals, incrementalRevenue, roi, paybackDays };
  }, [crew, ticket, liftPct]);

  const fmtMoney = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const fmtPayback = (d: number) => {
    if (!Number.isFinite(d) || d > 365) return "> 1 year";
    if (d < 1) return "< 1 day";
    if (d < 31) return `${Math.round(d)} day${Math.round(d) === 1 ? "" : "s"}`;
    if (d < 365) return `${Math.round(d / 30)} month${Math.round(d / 30) === 1 ? "" : "s"}`;
    return "1 year";
  };

  return (
    <section className="bg-background">
      <div className="container max-w-6xl py-24 md:py-32">
        <SectionHeading
          align="center"
          eyebrow="ROI calculator"
          title="What's being first worth?"
          lede="Slide a few numbers around. We use conservative industry averages — you'll likely beat them."
        />

        <div className="mx-auto mt-10 max-w-4xl overflow-hidden rounded-xl border border-border bg-card md:mt-12">
          <div className="grid gap-0 md:grid-cols-2">
            <div className="space-y-7 border-b border-border p-6 md:border-b-0 md:border-r md:p-7">
              <Slider
                label="Crew size"
                hint="Reps actively canvassing"
                min={1} max={25} step={1}
                value={crew} onChange={setCrew}
                format={(n) => `${n} rep${n === 1 ? "" : "s"}`}
              />
              <Slider
                label="Average ticket size"
                hint="Per signed contract"
                min={5000} max={50000} step={500}
                value={ticket} onChange={setTicket}
                format={fmtMoney}
              />
              <Slider
                label="Close-rate lift"
                hint="How much faster you arrive vs. competitors"
                min={5} max={35} step={1}
                value={liftPct} onChange={setLiftPct}
                format={(n) => `+${n}%`}
              />
            </div>

            <div className="space-y-6 bg-secondary/40 p-6 md:p-7">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                  Projected annual revenue lift
                </p>
                <p className="mt-2 font-mono-num text-4xl font-semibold leading-none tracking-tight text-primary md:text-5xl">
                  {fmtMoney(calc.incrementalRevenue)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  ~<span className="font-mono-num">{Math.round(calc.incrementalDeals)}</span> additional
                  deals at <span className="font-mono-num">{fmtMoney(ticket)}</span> each
                </p>
              </div>

              <div className="h-px bg-border" />

              <div className="grid grid-cols-2 gap-4">
                <Metric label="ROI vs. $899/yr" value={`${calc.roi.toFixed(0)}×`} tone="primary" />
                <Metric label="Payback time" value={fmtPayback(calc.paybackDays)} />
              </div>

              <div className="rounded-md border border-border bg-background/60 p-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Calculated against an industry-baseline close rate of 6% on cold canvassing and 25
                  additional doors-per-rep-per-month surfaced by Hail GPS. Real-world results vary by
                  territory density, sales process, and storm season.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Slider({
  label, hint, min, max, step, value, onChange, format,
}: {
  label: string; hint: string; min: number; max: number; step: number;
  value: number; onChange: (n: number) => void; format: (n: number) => string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className="text-xs text-muted-foreground/80">{hint}</p>
        </div>
        <p className="font-mono-num text-xl font-medium text-foreground">{format(value)}</p>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="slider-touch w-full cursor-pointer"
      />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "primary" }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono-num text-2xl font-semibold tracking-tight md:text-3xl ${tone === "primary" ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
