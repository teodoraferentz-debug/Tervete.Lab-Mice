import type { ReactNode } from 'react';

/** Bottom-of-screen column: safety note, presenter prompt and captions never overlap each other. */
export function BottomStack({ children }: { children: ReactNode }) {
  return <div className="bottom-stack">{children}</div>;
}
