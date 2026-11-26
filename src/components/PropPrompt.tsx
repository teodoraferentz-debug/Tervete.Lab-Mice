interface Props {
  label: string;
  text: string;
  detail?: string;
  accent?: string;
}

/** Cue for the presenter, e.g. "Raise the scent wheel". Sits above the captions. */
export function PropPrompt({ label, text, detail, accent }: Props) {
  return (
    <div className="prop-prompt" role="status" aria-live="polite" style={accent ? ({ '--accent': accent } as React.CSSProperties) : undefined}>
      <span className="prop-prompt__label">{label}</span>
      <span className="prop-prompt__text">{text}</span>
      {detail ? <span className="prop-prompt__detail">{detail}</span> : null}
    </div>
  );
}
