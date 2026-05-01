/**
 * Case study content. Hand-crafted prose for now — small enough to inline in
 * code without warranting an MDX pipeline. If we add 10+, swap to MDX.
 */

export interface CaseStudySection {
  eyebrow: string;
  heading: string;
  paragraphs: string[];
  pullQuote?: { text: string; attribution: string };
}

export interface CaseStudy {
  slug: string;
  headline: string;
  deck: string;
  region: string;
  companySize: string;
  stats: { label: string; value: string }[];
  sections: CaseStudySection[];
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "ridgeline-roofing",
    headline:
      "How Ridgeline Roofing tripled their close rate after the May storms",
    deck:
      "A four-truck Tornado Alley contractor swapped door-knocking guesswork for HailScout's polygon-grade hail data — and walked into the conference with the busiest spring of their decade.",
    region: "Oklahoma City, OK",
    companySize: "4 trucks · 11 crew",
    stats: [
      { value: "3.2×",  label: "Close rate vs. prior year" },
      { value: "$840K", label: "Q2 revenue" },
      { value: "11 hrs",  label: "Lead-time before competitors" },
    ],
    sections: [
      {
        eyebrow: "Before",
        heading: "Knocking blind on Tuesday morning.",
        paragraphs: [
          "Tornado Alley contractors have always known when the big stuff hit. The radio said it. The local news repeated it. By Tuesday morning, four other companies' yard signs were already up.",
          "Mark Henson, who runs Ridgeline out of a bay he rents on the south side of OKC, was tired of the routine. His crews would chase neighborhoods that looked promising — siding shredded, gutters torn — only to find that the actual hail core had passed three blocks east. The rest of the homes were fine. Cold knock, polite no.",
          "By the time he called his data guy and got something half-useful from the NOAA archive, the wave was over.",
        ],
      },
      {
        eyebrow: "The shift",
        heading: "Pull up the atlas, walk the polygon.",
        paragraphs: [
          "Ridgeline started using HailScout the week after a March supercell dropped 2.5″ stones across Cleveland County. Mark dropped the company's monitored-address list — every customer, every warranty, every prior estimate — into the watchlist on a Sunday night.",
          "Monday at 6 a.m. he had a Slack alert: forty-three of his addresses sat inside the 2.0″ band. By the time the news trucks were filming, his foreman knew exactly which streets to walk.",
          "What changed wasn't enthusiasm — Mark was already a hustler. What changed was precision. The crew stopped knocking on undamaged homes. Every door was a real door. Every conversation started with: I see this storm dropped golf-ball hail right here on your roof. Want me to take a look?",
        ],
        pullQuote: {
          text:
            "It's not that we work harder. It's that every single knock is at a house that actually needs us.",
          attribution: "Mark Henson, owner, Ridgeline Roofing",
        },
      },
      {
        eyebrow: "After",
        heading: "Three storms, $840K in Q2.",
        paragraphs: [
          "Ridgeline closed a third of every estimate they wrote in May. Their inspection-to-contract conversion went from a national-average 18% to a Tornado-Alley-respectable 42%. They added a fifth truck in July, paid cash for it, and named her Atlas.",
          "More importantly, the team stopped resenting the route. The map was the route. The atlas told them where to go. The crew talked to homeowners who actually had damage, who actually wanted help, who actually wrote checks. Door-knocking stopped being a numbers game and started being a service.",
          "The conference-week email from Mark to his 14 friends in the trade said it best: Stop trying to remember which neighborhood got hit last March. The atlas remembers.",
        ],
      },
    ],
  },
];

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return CASE_STUDIES.find((c) => c.slug === slug);
}
