/** Cartucho com um "A" de seta, na cor do console atual. */
export function Logo() {
  return (
    <span className="group inline-flex items-center gap-2.5">
      <svg viewBox="0 0 40 40" aria-hidden className="size-9 transition duration-300 group-hover:-rotate-6">
        <defs>
          <linearGradient id="arcLogoG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--tint)' }} />
            <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--tint) 40%, #000)' }} />
          </linearGradient>
        </defs>
        <path d="M8 3h19.5l7.5 7.5V35a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" fill="url(#arcLogoG)" />
        <path d="M27.5 3v5a2.5 2.5 0 0 0 2.5 2.5h5" fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="1.4" />
        <path d="M10 7h11M10 10h11" stroke="rgba(0,0,0,.3)" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="9" y="14" width="22" height="20.5" rx="3" fill="#0b0c12" />
        <path d="M14.2 30.6 20 18.2l5.8 12.4" fill="none" stroke="var(--tint)" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="17.6" y="25.2" width="4.8" height="2.6" rx="1.3" fill="#fff" />
      </svg>
      <span className="display hidden text-2xl tracking-wide sm:block">
        ARC<span className="text-tint-hi">Á</span>DIA
      </span>
    </span>
  );
}
