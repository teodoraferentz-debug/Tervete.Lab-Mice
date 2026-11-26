import { createContext, useContext } from 'react';
import type { StageApi } from '../three/StageApi';

/** The running stage (null until it has mounted). */
export const StageContext = createContext<StageApi | null>(null);
export const useStage = (): StageApi | null => useContext(StageContext);
