import type { StyleId } from "@/lib/theme";

/* ---------------------------------------------------------------------------
   The graphic voice of the guide: how it opens, and how it announces a section.

   Printed welcome books get their personality from three moves, and none of
   them is a background pattern: an expressive title, a mark beside every
   heading, and a rule that separates one thing from the next. These components
   are those three moves, done four ways.

   They are pure presentation — no data, no state, no client JavaScript — so a
   host switching direction changes how the guide feels without changing a word
   of what it says, and the guest downloads nothing extra for it.
--------------------------------------------------------------------------- */

/* -------------------------------- header ---------------------------------- */

export function GuideMasthead({
  style,
  eyebrow,
  title,
  subtitle,
  aside,
  back,
}: {
  style: StyleId;
  eyebrow: string;
  title: string;
  subtitle: string;
  /* Language selector, kept out of the composition's way. */
  aside: React.ReactNode;
  back?: React.ReactNode;
}) {
  const centred = style === "sello";

  return (
    <div className={centred ? "text-center" : ""}>
      {back}

      <div
        className={`flex items-start gap-3 ${centred ? "justify-center" : "justify-between"}`}
      >
        {!centred ? <Eyebrow style={style} text={eyebrow} /> : <span />}
        <div className={centred ? "absolute right-5 top-6" : ""}>{aside}</div>
      </div>

      {centred ? (
        <>
          {/* A rule interrupted by the eyebrow: the framed-poster move, where
              the title is the object and everything else defers to it. */}
          <div className="mt-1 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-white/40" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-white/70">{eyebrow}</span>
            <span className="h-px w-10 bg-white/40" />
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight">{title}</h1>
          <p className="mt-1 text-sm text-white/70">{subtitle}</p>
          <span className="mx-auto mt-4 block h-px w-24 bg-white/30" />
        </>
      ) : style === "editorial" ? (
        <>
          <span className="mt-3 block h-px w-full bg-white/25" />
          <h1 className="mt-3 font-display text-[2rem] font-semibold leading-[1.1] tracking-tight">
            {title}
          </h1>
          <div className="mt-3 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/25" />
            <p className="text-xs uppercase tracking-[0.18em] text-white/70">{subtitle}</p>
          </div>
        </>
      ) : style === "banda" ? (
        <>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight">{title}</h1>
          <p className="mt-1 text-sm text-white/70">{subtitle}</p>
          {/* The band that gives this direction its name, echoed at the foot of
              the masthead so the header reads as a designed block. */}
          <span className="mt-4 block h-1.5 w-16 rounded-full bg-white/70" />
        </>
      ) : (
        <>
          <h1 className="mt-3 font-display text-2xl font-semibold leading-tight">{title}</h1>
          <p className="text-sm text-white/70">{subtitle}</p>
        </>
      )}
    </div>
  );
}

function Eyebrow({ style, text }: { style: StyleId; text: string }) {
  if (style === "banda") {
    return (
      <span className="inline-block bg-white/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/80">
        {text}
      </span>
    );
  }
  return (
    <span
      className={`text-[11px] uppercase text-white/70 ${
        style === "editorial" ? "tracking-[0.28em]" : "tracking-[0.2em]"
      }`}
    >
      {text}
    </span>
  );
}

/* ---------------------------- section heading ----------------------------- */

export function SectionHeading({
  style,
  title,
  icon,
}: {
  style: StyleId;
  title: string;
  icon: React.ReactNode;
}) {
  if (style === "banda") {
    return (
      <h2 className="mb-3 flex items-center gap-2.5 bg-brand-ink px-3.5 py-2.5 font-display text-base font-semibold uppercase tracking-wide text-white [border-radius:var(--radius-card)]">
        <span className="opacity-80">{icon}</span>
        {title}
      </h2>
    );
  }

  if (style === "sello") {
    return (
      <div className="mb-4 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-brand-line text-brand">
          {icon}
        </span>
        <div className="mt-2 flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-brand-line" />
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <span className="h-px w-8 bg-brand-line" />
        </div>
      </div>
    );
  }

  if (style === "editorial") {
    return (
      <div className="mb-3">
        <span className="block h-px w-full bg-brand-line" />
        <h2 className="mt-2.5 flex items-baseline gap-2.5 font-display text-lg font-semibold">
          <span className="translate-y-0.5 text-brand">{icon}</span>
          <span className="uppercase tracking-[0.06em]">{title}</span>
        </h2>
      </div>
    );
  }

  /* Sereno: an icon in a soft disc and a hairline that stops where the words
     stop, which is quieter than a rule across the whole column. */
  return (
    <div className="mb-3">
      <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
          {icon}
        </span>
        {title}
      </h2>
      <span className="mt-2 block h-px w-12 bg-brand" />
    </div>
  );
}

/* Separator between sections in reading mode, where they flow one after
   another and need something to breathe against. */
export function SectionDivider({ style }: { style: StyleId }) {
  if (style === "sello") {
    return (
      <div className="my-7 flex items-center justify-center gap-2" aria-hidden>
        <span className="h-px w-8 bg-line" />
        <span className="h-1.5 w-1.5 rotate-45 bg-brand-line" />
        <span className="h-px w-8 bg-line" />
      </div>
    );
  }
  if (style === "editorial") return <span className="my-7 block h-px w-full bg-line" aria-hidden />;
  if (style === "banda") return <span className="my-6 block" aria-hidden />;
  return <span className="my-6 block h-px w-16 bg-line" aria-hidden />;
}
