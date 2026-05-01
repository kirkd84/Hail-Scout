/**
 * Inline SVG icons. Topographic-feel — thin strokes, geometric primitives.
 * 1.4-1.6px stroke weight on a 16px viewBox renders crisply at 16px.
 */

import { type SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const IconMap = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M5.5 13.5L1.5 14.5V3L5.5 2M5.5 13.5L10.5 14M5.5 13.5V2M10.5 14L14.5 13V2.5L10.5 2M10.5 14V2M5.5 2L10.5 2" />
  </svg>
);
export const IconPin = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M8 14.5C8 14.5 13 10.5 13 6.5A5 5 0 0 0 3 6.5C3 10.5 8 14.5 8 14.5Z" />
    <circle cx="8" cy="6.5" r="1.7" />
  </svg>
);
export const IconAddresses = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M2.5 14.5V6L8 2L13.5 6V14.5" />
    <path d="M6 14.5V9.5H10V14.5" />
  </svg>
);
export const IconFlag = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 14V2" />
    <path d="M3 2.5L10 2.5L8.5 5L10 7.5H3" />
  </svg>
);
export const IconReport = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 1.5H10L13 4.5V14.5H3Z" />
    <path d="M10 1.5V4.5H13" />
    <path d="M5.5 8H10.5" />
    <path d="M5.5 11H10.5" />
  </svg>
);
export const IconSettings = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="8" r="2.2" />
    <path d="M8 1.5V3M8 13V14.5M2.7 5L4 5.8M12 10.2L13.3 11M2.7 11L4 10.2M12 5.8L13.3 5M1.5 8H3M13 8H14.5" />
  </svg>
);
export const IconSearch = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
);
export const IconLayers = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M8 2L1.5 5.5L8 9L14.5 5.5Z" />
    <path d="M1.5 8.5L8 12L14.5 8.5" />
    <path d="M1.5 11.5L8 15L14.5 11.5" />
  </svg>
);
export const IconCompass = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="8" r="6.5" />
    <path d="M5 11L7 8L9 5L11 5L9 8L7 11Z" />
  </svg>
);
export const IconUsers = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="6" cy="5.5" r="2.5" />
    <path d="M1.5 14C1.5 11.5 3.5 9.5 6 9.5S10.5 11.5 10.5 14" />
    <path d="M11 9.5C13 9.5 14.5 11 14.5 13" />
    <circle cx="11.5" cy="6" r="2" />
  </svg>
);
export const IconChevronRight = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M6 3L11 8L6 13" />
  </svg>
);
export const IconClose = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5" />
  </svg>
);
export const IconCloud = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4 11.5C2.5 11.5 1.5 10.3 1.5 9C1.5 7.5 2.7 6.5 4 6.5C4 4.5 5.5 3 7.5 3S11 4.5 11 6.5C12.5 6.5 13.5 7.7 13.5 9S12.5 11.5 11 11.5Z" />
  </svg>
);
export const IconBolt = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M9 1.5L3 9.5H7.5L6.5 14.5L13 6.5H8.5L9 1.5Z" />
  </svg>
);
export const IconCommand = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4.5 1.5C3.4 1.5 2.5 2.4 2.5 3.5S3.4 5.5 4.5 5.5H6V11H4.5C3.4 11 2.5 11.9 2.5 13S3.4 14.5 4.5 14.5S6.5 13.6 6.5 12.5V11M11.5 1.5C12.6 1.5 13.5 2.4 13.5 3.5S12.6 5.5 11.5 5.5H10V11H11.5C12.6 11 13.5 11.9 13.5 13S12.6 14.5 11.5 14.5S9.5 13.6 9.5 12.5V11M6 5.5H10M6 11H10" />
  </svg>
);
export const IconPhone = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 3.5C3 2.7 3.7 2 4.5 2H5.8L7 4.5L5.6 5.5C6.3 7 7.5 8.2 9 8.9L10 7.5L12.5 8.7V10C12.5 10.8 11.8 11.5 11 11.5C7.5 11.5 3 7 3 3.5Z" />
  </svg>
);
export const IconMail = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="2" y="3.5" width="12" height="9" rx="1.2" />
    <path d="M2.5 4.5L8 9L13.5 4.5" />
  </svg>
);
export const IconCalendar = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="2" y="3.5" width="12" height="10.5" rx="1.2" />
    <path d="M2 6.5H14M5 2V4M11 2V4" />
  </svg>
);
export const IconUser = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M3 14C3 11.5 5.2 9.5 8 9.5S13 11.5 13 14" />
  </svg>
);
export const IconPlus = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M8 3.5V12.5M3.5 8H12.5" />
  </svg>
);
export const IconTrash = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M2.5 4.5H13.5M5.5 4.5V3.2C5.5 2.5 6 2 6.7 2H9.3C10 2 10.5 2.5 10.5 3.2V4.5M4 4.5L4.7 13.3C4.7 13.7 5.1 14 5.5 14H10.5C10.9 14 11.3 13.7 11.3 13.3L12 4.5" />
  </svg>
);
export const IconLogo = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="8" r="6" />
    <circle cx="8" cy="8" r="3.7" />
    <circle cx="8" cy="8" r="1.6" />
    <path d="M2.5 8 Q8 4 13.5 8" strokeOpacity="0.6" />
  </svg>
);
