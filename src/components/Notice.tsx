import { useEffect } from 'react';

interface Props {
  message: string;
  /** Persistent notices (e.g. "map out of view") have no close button and no timeout. */
  onDismiss?: () => void;
}

export function Notice({ message, onDismiss }: Props) {
  useEffect(() => {
    if (!onDismiss) return;
    const id = setTimeout(onDismiss, 9000);
    return () => clearTimeout(id);
  }, [onDismiss, message]);

  return (
    <div className="notice" role="status" aria-live="polite">
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" className="notice__close" onClick={onDismiss} aria-label="Dismiss message">
          ×
        </button>
      ) : null}
    </div>
  );
}
