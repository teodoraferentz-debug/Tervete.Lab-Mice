interface Props {
  speaker: string;
  text: string;
  /** Narrator lines describe the real park; shown in a distinct style. */
  tone?: 'mascot' | 'narrator' | 'info';
  accent?: string;
}

/** Captions for all spoken dialogue. role=status so screen readers announce each new line politely. */
export function Subtitles({ speaker, text, tone = 'mascot', accent }: Props) {
  return (
    <div className={`subtitles subtitles--${tone}`} role="status" aria-live="polite" aria-atomic="true" style={accent ? ({ '--accent': accent } as React.CSSProperties) : undefined}>
      <span className="subtitles__speaker">{speaker}</span>
      <span className="subtitles__text" key={text}>
        {text}
      </span>
    </div>
  );
}
