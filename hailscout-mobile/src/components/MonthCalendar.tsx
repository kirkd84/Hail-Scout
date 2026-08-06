import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from "react-native";
import { theme, SPACING, RADIUS } from "@/lib/tokens";

/**
 * Month-grid date picker, built in plain JS on purpose.
 *
 * A native picker (@react-native-community/datetimepicker) would be a native
 * module, which means a new store build to ship it. This is pure JS, so it
 * rides an over-the-air update instead — the whole reason the rep can get
 * "jump to any date" without waiting on review.
 *
 * All arithmetic is UTC because storms are grouped by UTC day everywhere else
 * in the app; using local time here would put a late-evening storm on the
 * wrong square.
 */

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

interface Props {
  /** Currently selected day, "YYYY-MM-DD", or null. */
  value: string | null;
  onPick: (day: string) => void;
  /** Earliest selectable day — the archive floor. */
  min?: string;
  /** Latest selectable day; defaults to today (UTC). */
  max?: string;
}

export function MonthCalendar({ value, onPick, min = "2021-01-01", max }: Props) {
  const t = theme(useColorScheme());
  const todayIso = new Date().toISOString().slice(0, 10);
  const maxIso = max ?? todayIso;

  // Open on the selected month, else the newest allowed month.
  const initial = (value ?? maxIso).split("-").map(Number);
  const [year, setYear] = useState(initial[0]);
  const [month, setMonth] = useState(initial[1] - 1); // 0-indexed

  const grid = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const step = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  };

  // Disable a month arrow once it would leave the allowed range entirely.
  const monthStart = iso(year, month, 1);
  const monthEnd = iso(year, month, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  const canPrev = monthStart > min;
  const canNext = monthEnd < maxIso;

  return (
    <View>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => canPrev && step(-1)}
          disabled={!canPrev}
          accessibilityLabel="Previous month"
          style={[styles.arrow, { borderColor: t.border, opacity: canPrev ? 1 : 0.35 }]}
        >
          <Text style={[styles.arrowTxt, { color: t.fg }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: t.fg }]}>
          {MONTHS[month]} {year}
        </Text>
        <TouchableOpacity
          onPress={() => canNext && step(1)}
          disabled={!canNext}
          accessibilityLabel="Next month"
          style={[styles.arrow, { borderColor: t.border, opacity: canNext ? 1 : 0.35 }]}
        >
          <Text style={[styles.arrowTxt, { color: t.fg }]}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={`${w}-${i}`} style={[styles.weekday, { color: t.fgMuted }]}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {grid.map((day, i) => {
          if (day === null) return <View key={`b-${i}`} style={styles.cell} />;
          const dayIso = iso(year, month, day);
          const disabled = dayIso < min || dayIso > maxIso;
          const selected = dayIso === value;
          const isToday = dayIso === todayIso;
          return (
            <TouchableOpacity
              key={dayIso}
              disabled={disabled}
              onPress={() => onPick(dayIso)}
              style={styles.cell}
              accessibilityLabel={dayIso}
            >
              <View
                style={[
                  styles.dayInner,
                  selected && { backgroundColor: t.primary },
                  !selected && isToday && { borderWidth: 1, borderColor: t.border },
                ]}
              >
                <Text
                  style={[
                    styles.dayTxt,
                    { color: selected ? t.primaryFg : disabled ? t.fgMuted : t.fg },
                    disabled && { opacity: 0.35 },
                  ]}
                >
                  {day}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowTxt: { fontSize: 22, lineHeight: 24, fontWeight: "600" },
  monthLabel: { fontSize: 15, fontWeight: "600" },
  weekRow: { flexDirection: "row" },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Courier",
    marginBottom: 4,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  // 7 columns; height keeps each tap target at 44px.
  cell: { width: `${100 / 7}%`, height: 44, alignItems: "center", justifyContent: "center" },
  dayInner: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  dayTxt: { fontSize: 14, fontWeight: "500" },
});
