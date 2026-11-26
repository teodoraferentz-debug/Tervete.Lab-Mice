import { useEffect, useRef } from 'react';
import { GUARDIANS, type GuardianId } from '../content/guardians';
import type { ScreenPoint } from '../three/StageApi';
import { CheckIcon, SenseIcon } from './icons';
import { useStage } from './StageContext';

interface Props {
  visited: readonly GuardianId[];
  justActivated: GuardianId | null;
  onSelect: (id: GuardianId) => void;
}

/**
 * Real buttons laid over the 3D zones, so they are keyboard- and screen-reader-friendly.
 * Their screen position follows the 3D scene on every frame (no React re-render).
 */
export function ZoneMarkers({ visited, justActivated, onSelect }: Props) {
  const stage = useStage();
  const refs = useRef(new Map<GuardianId, HTMLButtonElement>());

  useEffect(() => {
    if (!stage) return;
    const point: ScreenPoint = { x: 0, y: 0, visible: false };
    const update = () => {
      GUARDIANS.forEach((g) => {
        const el = refs.current.get(g.id);
        if (!el) return;
        stage.project(g.id, point);
        el.style.transform = `translate(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px) translate(-50%, -50%)`;
        el.style.visibility = point.visible ? 'visible' : 'hidden';
      });
    };
    update();
    return stage.onFrame(update);
  }, [stage]);

  return (
    <div className="markers">
      {GUARDIANS.map((g) => {
        const awake = visited.includes(g.id);
        return (
          <button
            key={g.id}
            type="button"
            ref={(el) => {
              if (el) refs.current.set(g.id, el);
              else refs.current.delete(g.id);
            }}
            className={`marker${awake ? ' marker--awake' : ''}${justActivated === g.id ? ' marker--new' : ''}`}
            style={{ '--accent': g.themeColor, visibility: 'hidden' } as React.CSSProperties}
            onClick={() => onSelect(g.id)}
            aria-label={`${awake ? 'Replay' : 'Open'} ${g.name}: ${g.senseLabel}, ${g.zone.name}. ${awake ? 'Awake.' : 'Asleep.'}`}
          >
            <span className="marker__badge">
              <SenseIcon sense={g.sense} />
              {awake ? (
                <span className="marker__check">
                  <CheckIcon />
                </span>
              ) : null}
            </span>
            <span className="marker__label">
              <strong>{g.name}</strong>
              <small>{g.zone.name}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
