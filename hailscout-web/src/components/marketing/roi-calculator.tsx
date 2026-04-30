"use client";

import { useState, useMemo } from "react";

/**
 * ROI calculator — gives prospects a concrete number to anchor on.
 * Inputs: crew size, avg ticket, close-rate lift.
 * Output: projected annual revenue lift + ROI multiple + payback time.
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
    <section className="bg-card border-y border-border">
      <div className="container py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center mb-10">
          <p className="font-mono-num text-xs uppercase tracking-wide-caps text-copper">ROI calculator</p>
          <h2 className="mt-3 font-display text-4xl font-medium tracking-tight-display text-foreground md:text-5xl">
            What&apos;s HailScout worth to your crew?
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            Slide a few numbers around. We use conservative industry averages — you&apos;ll likely beat them.
          </p>
        </div>

        <div className="mx-auto max-w-4xl rounded-xl border border-border bg-background shadow-atlas overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="p-7 md:p-8 space-y-7 border-b md:border-b-0 md:border-r border-border">
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

            <div className="p-7 md:p-8 bg-secondary/30 space-y-6">
              <div>
                <p className="font-mono-num text-[11px] uppercase tracking-wide-caps text-copper">
                  Projected annual revenue lift
                </p>
                <p className="mt-2 font-display text-5xl font-medium tracking-tight-display text-primary leading-none">
                  {fmtMoney(calc.incrementalRevenue)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  ~{Math.round(calc.incrementalDeals)} additional deals at {fmtMoney(ticket)} each
                </p>
              </div>

              <div className="rule-atlas" />

              <div className="grid grid-cols-2 gap-4">
                <Metric label="ROI vs. $899/yr" value={`${calc.roi.toFixed(0)}×`} tone="copper" />
                <Metric label="Payback time" value={fmtPayback(calc.paybackDays)} />
              </div>

              <div className="rounded-md border border-copper/30 bg-copper/5 p-4">
                <p className="text-xs leading-relaxed text-foreground/85">
                  Calculated against an industry-baseline close rate of 6% on cold canvassing and 25
                  additional doors-per-rep-per-month surfaced by HailScout. Real-world results vary by
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
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <p className="font-display text-2xl font-medium tracking-tight-display text-foreground">{format(value)}</p>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-copper cursor-pointer"
      />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "copper" }) {
  return (
    <div>
      <p className="font-mono-num text-[10px] uppercase tracking-wide-caps text-foreground/55">{label}</p>
      <p className={`mt-1 font-display text-3xl font-medium tracking-tight-display ${tone === "copper" ? "text-copper" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
