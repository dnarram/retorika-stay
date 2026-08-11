type IconProps = { className?: string; size?: number };

/* Fourteen hand-drawn icons, ~2 kB in total. A full icon library would have
   pulled in hundreds of kB for this. They all inherit currentColor and carry
   aria-hidden: the meaning is carried by the text beside them. */
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
});

export const IconWifi = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M2 8.8a16 16 0 0 1 20 0M5 12.5a11 11 0 0 1 14 0M8.5 16.1a6 6 0 0 1 7 0" />
    <circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconKey = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="8" cy="12" r="4" />
    <path d="M12 12h9M18 12v3M15.5 12v2" />
  </svg>
);

export const IconAlert = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" />
    <path d="M12 9.5v4M12 16.8v.01" />
  </svg>
);

export const IconMap = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" />
    <path d="M9 4v13M15 6.5v13" />
  </svg>
);

export const IconPin = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

export const IconWalk = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="13" cy="4.5" r="1.8" />
    <path d="M11 21l1.5-5.5L10 13l1-5 3 1.5 2.5 2M10 13l-2 3.5M14.5 15.5 17 21" />
  </svg>
);

export const IconPhone = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z" />
  </svg>
);

export const IconCopy = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </svg>
);

export const IconCheck = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
  </svg>
);

export const IconCross = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconInfo = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.8v.01" />
  </svg>
);

export const IconQr = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" />
    <rect x="14" y="3.5" width="6.5" height="6.5" rx="1" />
    <rect x="3.5" y="14" width="6.5" height="6.5" rx="1" />
    <path d="M14 14h3v3h-3zM20.5 14v6.5H17" />
  </svg>
);

export const IconArrow = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </svg>
);

export const IconPrint = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M7 9V3.5h10V9M7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
    <rect x="7" y="14" width="10" height="6.5" rx="1" />
  </svg>
);

export const IconClock = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.3l3.2 2" />
  </svg>
);

export const IconGlobe = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3.2 9.5h17.6M3.2 14.5h17.6M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
  </svg>
);

export const IconShare = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3.5v12M8 7l4-3.5L16 7" />
    <path d="M6 12H4.5v8h15v-8H18" />
  </svg>
);

export const IconHome = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 10.5 12 4l8 6.5M6 12v8h12v-8" />
    <path d="M10 20v-5h4v5" />
  </svg>
);

export const IconHelp = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.2a2.6 2.6 0 1 1 3.4 2.5c-.6.2-.9.8-.9 1.4v.4M12 16.8v.01" />
  </svg>
);

export const IconRules = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6.5 3.5h11v17h-11z" />
    <path d="M9.5 8h5M9.5 12h5M9.5 16h3" />
  </svg>
);

export const IconLuggage = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="5" y="8" width="14" height="12" rx="2" />
    <path d="M9 8V5.5h6V8M10 12v4M14 12v4" />
  </svg>
);

export const IconGrid = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </svg>
);
