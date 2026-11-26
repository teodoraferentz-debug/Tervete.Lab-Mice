import { useEffect, useState } from 'react';
import { PITCH } from '../content/pitchScript';
import type { ArStatus } from '../experience/sceneTypes';

interface Props {
  status: ArStatus;
  onContinueMagic: () => void;
}

/** Shown while the camera looks for the printed map. Magic Mode is always one tap away. */
export function ScanOverlay({ status, onContinueMagic }: Props) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(id);
  }, []);

  return (
    <section className="scan" aria-labelledby="scan-title">
      <div className="scan__reticle" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="scan__panel">
        <h2 id="scan-title">{PITCH.scan.title}</h2>
        <p>{status === 'starting' ? 'Starting the camera…' : PITCH.scan.body}</p>
        {slow ? <p className="scan__slow">{PITCH.scan.slowHint}</p> : null}
        <button type="button" className="btn btn--secondary btn--compact" onClick={onContinueMagic}>
          {PITCH.scan.continueMagic}
        </button>
      </div>
    </section>
  );
}
