import { useEffect, useRef, useState } from 'react';
import { MenuIcon } from '../components/icons';
import { GUARDIANS } from '../content/guardians';
import type { ExperienceController } from '../experience/ExperienceController';
import type { ExperienceState } from '../experience/sceneState';
import type { JumpTarget } from '../experience/sceneTypes';

interface Props {
  state: ExperienceState;
  controller: ExperienceController;
}

const SCENES: Array<{ id: JumpTarget; label: string }> = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'map', label: 'Map' },
  ...GUARDIANS.map((g) => ({ id: g.id as JumpTarget, label: `${g.name} · ${g.senseLabel}` })),
  { id: 'finale', label: 'Tree of Five Senses' },
];

const isTyping = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

/**
 * Discreet presenter panel. Always reachable with the keyboard:
 *   P panel · ← previous · → next · M mute · Esc close.
 * Restart asks for a second press so it cannot be triggered by accident mid-pitch.
 */
export function PresenterControls({ state, controller }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const handleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      switch (e.key) {
        case 'ArrowRight':
          controller.next();
          break;
        case 'ArrowLeft':
          controller.prev();
          break;
        case 'm':
        case 'M':
          controller.toggleMute();
          break;
        case 'p':
        case 'P':
          setOpen((o) => !o);
          break;
        case 'Escape':
          setOpen(false);
          handleRef.current?.focus();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller]);

  useEffect(() => {
    if (!confirmRestart) return;
    const id = setTimeout(() => setConfirmRestart(false), 3500);
    return () => clearTimeout(id);
  }, [confirmRestart]);

  const arLabel = state.mode === 'ar' ? `AR · ${state.ar}` : state.mode === 'vr' ? 'VR' : 'Magic Mode';

  return (
    <aside className={`presenter${open ? ' presenter--open' : ''}`} aria-label="Presenter controls">
      <button
        ref={handleRef}
        type="button"
        className="presenter__handle"
        aria-expanded={open}
        aria-controls="presenter-panel"
        onClick={() => setOpen((o) => !o)}
      >
        <MenuIcon />
        <span className="visually-hidden">Presenter controls</span>
      </button>

      {open ? (
        <div id="presenter-panel" className="presenter__panel" role="group" aria-label="Presenter">
          <p className="presenter__status" aria-live="polite">
            {arLabel} · {state.visited.length}/{GUARDIANS.length} awake
          </p>

          <div className="presenter__row">
            <button type="button" className="pbtn" onClick={controller.prev}>
              ← Previous
            </button>
            <button type="button" className="pbtn pbtn--primary" onClick={controller.next}>
              Next →
            </button>
          </div>

          <div className="presenter__row">
            <button type="button" className="pbtn" aria-pressed={state.muted} onClick={controller.toggleMute}>
              {state.muted ? 'Sound off' : 'Sound on'}
            </button>
            <button type="button" className="pbtn" disabled={state.mode === 'magic'} onClick={controller.enterMagic}>
              {state.mode === 'magic' ? 'Magic Mode on' : 'Switch to Magic Mode'}
            </button>
          </div>

          <nav aria-label="Scenes">
            <ul className="presenter__scenes">
              {SCENES.map((s) => {
                const guardian = GUARDIANS.find((g) => g.id === s.id);
                const awake = guardian ? state.visited.includes(guardian.id) : false;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="pbtn pbtn--scene"
                      aria-current={state.scene === s.id ? 'true' : undefined}
                      onClick={() => controller.goTo(s.id)}
                    >
                      <i
                        aria-hidden="true"
                        className={awake ? 'dot dot--on' : 'dot'}
                        style={guardian ? ({ '--accent': guardian.themeColor } as React.CSSProperties) : undefined}
                      />
                      {s.label}
                      {awake ? <span className="visually-hidden"> (awake)</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="presenter__row">
            <button
              type="button"
              className={`pbtn pbtn--danger${confirmRestart ? ' pbtn--confirm' : ''}`}
              onClick={() => {
                if (confirmRestart) {
                  setConfirmRestart(false);
                  controller.restart();
                } else {
                  setConfirmRestart(true);
                }
              }}
            >
              {confirmRestart ? 'Press again to restart' : 'Restart'}
            </button>
          </div>

          <p className="presenter__keys">P panel · ← → scenes · M sound · Esc close</p>
        </div>
      ) : null}
    </aside>
  );
}
