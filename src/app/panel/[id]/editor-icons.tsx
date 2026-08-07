export { IconArrow, IconCheck, IconCross, IconInfo, IconQr } from "@/components/icons";

/* The only icon used exclusively by the dashboard: no reason to ship it in the
   guest guide, which is the screen that has to stay light. */
export const IconTrash = ({ size = 20, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    focusable="false"
    className={className}
  >
    <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 11v5.5M13.5 11v5.5" />
  </svg>
);
