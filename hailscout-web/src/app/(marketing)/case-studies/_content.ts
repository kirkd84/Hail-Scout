/**
 * Playbook content for /case-studies — "How crews run Hail GPS".
 *
 * HONESTY REFRAME (2026-08): the previous content here was a fictional
 * company ("Ridgeline Roofing", invented owner quotes, invented revenue
 * figures) presented as a real customer story. That violates the site's
 * honesty rules. Until real customers give us permission to publish
 * real numbers, this page carries scenario WALKTHROUGHS instead —
 * explicitly labeled as workflows, not results. Clock times are
 * illustrative; every product capability referenced is shipped.
 *
 * Colocated with the route (underscore = never routable) so the index,
 * detail page, and OG image share one source of truth.
 */

export interface PlaybookStep {
  /** Mono clock label, e.g. "06:41". Illustrative, not a measurement. */
  time: string;
  title: string;
  body: string;
  /** Product surface used at this step — rendered as a mono chip. */
  surface?: string;
  /** Hail sizes (inches) rendered as data chips via hailColor(). */
  sizes?: number[];
}

export interface PlaybookPhase {
  eyebrow: string;
  heading: string;
  steps: PlaybookStep[];
}

export interface Playbook {
  slug: string;
  title: string;
  deck: string;
  /** Mono metadata line, e.g. "ONE STORM DAY". */
  timeframe: string;
  phases: PlaybookPhase[];
}

export const PLAYBOOKS: Playbook[] = [
  {
    slug: "storm-day",
    title: "The storm day",
    deck: "From the morning heads-up to the first knock — how a crew runs Hail GPS through a hail day, hour by hour.",
    timeframe: "One storm day",
    phases: [
      {
        eyebrow: "Morning",
        heading: "Know it's coming before it fires.",
        steps: [
          {
            time: "06:41",
            title: "The heads-up lands",
            body: "Your phone buzzes: hail is forecast for your area today. Hail GPS checks the national hail forecast against your saved territory every morning and only sends the heads-up when the odds are worth acting on — nobody gets woken up over a long shot.",
            surface: "Morning outlook alert",
          },
          {
            time: "07:30",
            title: "Plan around it",
            body: "You keep the afternoon flexible, tell the crews to wrap the morning's estimates by lunch, and double-check the alert zone drawn around your service area.",
            surface: "Alert zones",
          },
        ],
      },
      {
        eyebrow: "Afternoon",
        heading: "Watch it land in real time.",
        steps: [
          {
            time: "15:07",
            title: "Cells fire west of town",
            body: "The live map starts painting. New hail data lands about every two minutes during a storm, and the radar loop shows you where the cell is headed next.",
            surface: "Live map · radar loop",
          },
          {
            time: "15:19",
            title: "Your alert goes off",
            body: "A tracked cell crosses your alert zone. Email, text, Slack, or a notification on your phone — however you set it up, it finds you.",
            surface: "Storm alerts",
          },
          {
            time: "15:40",
            title: "Read the swath",
            body: "Zoom in. The colors are hail sizes — the same scale the whole industry uses. The core of this one runs from quarter up to golf ball, and you can see exactly which streets sit under the biggest band.",
            surface: "Hail size bands",
            sizes: [1.0, 1.5, 1.75],
          },
        ],
      },
      {
        eyebrow: "Evening",
        heading: "Turn the swath into a route.",
        steps: [
          {
            time: "17:30",
            title: "Build tomorrow's route",
            body: "Drop pins along the streets under the biggest band and split them between reps. Everyone sees the same pins on their own phone — no group-text screenshots.",
            surface: "Canvassing pins",
          },
          {
            time: "18:10",
            title: "Check your own book first",
            body: "Look up the addresses you've already worked. Past customers sitting inside the swath get a call from you tonight — not a knock from a competitor tomorrow.",
            surface: "Address history",
          },
        ],
      },
      {
        eyebrow: "Next morning",
        heading: "Every knock inside the band.",
        steps: [
          {
            time: "08:00",
            title: "Walk the polygon",
            body: "The crew works the pinned streets. On the porch, pull up the address: the storm's date and the hail size at that exact roof, on your phone, in front of the homeowner.",
            surface: "At-address lookup",
          },
        ],
      },
    ],
  },
  {
    slug: "canvassing-week",
    title: "The canvassing week",
    deck: "A storm hit three weeks ago and the neighborhood has cooled off. How a crew works an older swath, Monday to Friday.",
    timeframe: "Five working days",
    phases: [
      {
        eyebrow: "Monday",
        heading: "Pick the storm worth a week.",
        steps: [
          {
            time: "08:15",
            title: "Search by date",
            body: "You heard a subdivision got hit a few weeks back. Date-search the archive — storms on record back to 2021 — find the day, and lay the swath over the neighborhood.",
            surface: "Storm archive",
          },
          {
            time: "09:00",
            title: "Check the sizes",
            body: "The band over the subdivision reads half-dollar to walnut. Big enough to damage shingles, big enough to be worth the week.",
            sizes: [1.25, 1.5],
          },
        ],
      },
      {
        eyebrow: "Tuesday – Wednesday",
        heading: "Work the band, not the block.",
        steps: [
          {
            time: "08:30",
            title: "Pin the route",
            body: "Split the streets under the band between reps. Every knock gets a pin and a status, so nobody hits the same door twice and nobody wastes an afternoon outside the swath.",
            surface: "Canvassing pins",
          },
          {
            time: "16:45",
            title: "End-of-day read",
            body: "The map shows exactly what got covered, what turned into appointments, and what's left for tomorrow.",
          },
        ],
      },
      {
        eyebrow: "Thursday",
        heading: "The hesitant homeowner.",
        steps: [
          {
            time: "11:20",
            title: "Show, don't argue",
            body: "“We never got hail here.” Pull the address up on the spot: the storm's date and the size at that roof. A map beats a pitch.",
            surface: "At-address lookup",
          },
          {
            time: "11:35",
            title: "Leave the report",
            body: "Generate a hail report — the storm, the sizes, the affected area — and email it before you're off the porch. Something concrete for the kitchen-table conversation.",
            surface: "Hail reports",
          },
        ],
      },
      {
        eyebrow: "Friday",
        heading: "Set up the next one.",
        steps: [
          {
            time: "15:00",
            title: "Watch the forecast",
            body: "Check whether hail is in the outlook for the weekend, and make sure your alert zones cover the next market you want to work.",
            surface: "Outlook · alert zones",
          },
          {
            time: "15:30",
            title: "Let the alerts run",
            body: "If a storm lands Saturday, you'll know within minutes — before the branded yard signs go up.",
            surface: "Storm alerts",
          },
        ],
      },
    ],
  },
];

export function getPlaybook(slug: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.slug === slug);
}
