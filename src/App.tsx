import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameMode, LevelFlowState } from '@/types/levels';
import { getLevelConfig, getModeConfig, getModeLevelColors, loadLevelsConfig, resolveLevelsConfig } from '@/lib/levels';
import { createGameEngine, type GameEngine } from '@/game/createGameEngine';
import { LoaderOverlay } from '@/components/LoaderOverlay';
import { useGestureRecognizerBoot, useGestureCamera } from '@/hooks/useGestureRecognizer';
import { GameViewport } from '@/components/GameViewport';
import { LobbyPanel } from '@/components/LobbyPanel';
import { LevelIntroModal } from '@/components/LevelIntroModal';
import { LevelTaskBar } from '@/components/LevelTaskBar';
import { LevelWonModal } from '@/components/LevelWonModal';
import { LevelOutroModal } from '@/components/LevelOutroModal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/i18n/LanguageContext';
import { HandCursorOverlay } from '@/components/HandCursorOverlay';
import { HandControlIntroModal } from '@/components/HandControlIntroModal';
import './App.css';

import type { GestureRecognizerStatus } from '@/hooks/useGestureRecognizer';

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function mergeLoadStatus(
  modelText: string,
  gestureStatus: GestureRecognizerStatus,
  t: (key: 'loadingGestureModel' | 'gestureUnavailable', ...args: unknown[]) => string,
): string {
  const parts = [modelText];
  if (gestureStatus === 'loading') parts.push(t('loadingGestureModel'));
  else if (gestureStatus === 'error') parts.push(t('gestureUnavailable'));
  return parts.join(' · ');
}

export default function App() {
  const { language, t } = useLanguage();
  const tRef = useRef(t);
  tRef.current = t;
  const viewportRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [rawLevelsConfig, setRawLevelsConfig] = useState<Awaited<ReturnType<typeof loadLevelsConfig>>>(null);
  const [loadStatus, setLoadStatus] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [handIntroDone, setHandIntroDone] = useState(false);

  const levelsConfig = useMemo(
    () => (rawLevelsConfig ? resolveLevelsConfig(rawLevelsConfig, language) : null),
    [rawLevelsConfig, language],
  );

  const { bootStatus: gestureBootStatus } = useGestureRecognizerBoot();
  const ensureGestureCamera = useGestureCamera();
  const gestureBootDone = gestureBootStatus === 'ready' || gestureBootStatus === 'error';
  const modelProgressRef = useRef('');
  const gestureBootStatusRef = useRef(gestureBootStatus);
  gestureBootStatusRef.current = gestureBootStatus;

  const [lobbyVisible, setLobbyVisible] = useState(true);
  const [currentMode, setCurrentMode] = useState<GameMode | null>(null);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [flowState, setFlowState] = useState<LevelFlowState>('idle');
  const [taskActive, setTaskActive] = useState(false);

  useEffect(() => {
    void loadLevelsConfig().then(setRawLevelsConfig);
  }, []);

  const updateLoadStatus = useCallback(() => {
    setLoadStatus(mergeLoadStatus(modelProgressRef.current, gestureBootStatus, t));
  }, [gestureBootStatus, t]);

  useEffect(() => {
    modelProgressRef.current = t('loading');
    updateLoadStatus();
  }, [language, t, updateLoadStatus]);

  useEffect(() => {
    if (modelReady && gestureBootDone && !loadError) {
      setLoadStatus(t('ready'));
      window.setTimeout(() => setShowLoader(false), 200);
    }
  }, [modelReady, gestureBootDone, loadError, t]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const engine = createGameEngine(el, {
      onLoadProgress: (bytes) => {
        const text = tRef.current('loadingProgress', fmtBytes(bytes));
        modelProgressRef.current = text;
        setLoadStatus(mergeLoadStatus(text, gestureBootStatusRef.current, tRef.current));
      },
      onLoadComplete: () => {
        setModelReady(true);
      },
      onLoadError: (err) => {
        const msg = err instanceof Error ? err.message : tRef.current('failedLoadModel');
        setLoadError(msg);
      },
    });

    engineRef.current = engine;
    syncPanelCamera(engine, lobbyVisible, panelRef.current?.offsetWidth ?? 0);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const syncPanelCamera = useCallback(
    (engine: GameEngine, panelVisible: boolean, panelWidth: number) => {
      engine.applyPanelAwareCamera(panelVisible, panelWidth);
    },
    [],
  );

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    syncPanelCamera(engine, lobbyVisible, panelRef.current?.offsetWidth ?? 0);
  }, [lobbyVisible, syncPanelCamera]);

  useEffect(() => {
    const onResize = () => {
      const engine = engineRef.current;
      if (!engine) return;
      syncPanelCamera(engine, lobbyVisible, panelRef.current?.offsetWidth ?? 0);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [lobbyVisible, syncPanelCamera]);

  const modeConfig = useMemo(
    () => getModeConfig(levelsConfig, currentMode),
    [levelsConfig, currentMode],
  );

  const levelConfig = useMemo(
    () => getLevelConfig(levelsConfig, currentMode, currentLevel),
    [levelsConfig, currentMode, currentLevel],
  );

  const totalLevels = modeConfig?.levels.length ?? 0;

  const celebrationColors = useMemo(
    () => getModeLevelColors(modeConfig?.levels ?? []),
    [modeConfig],
  );

  const handleSelectMode = (mode: GameMode) => {
    if (!levelsConfig) {
      alert(t('failedLoadLevels'));
      return;
    }
    setCurrentMode(mode);
    setLobbyVisible(false);
    setCurrentLevel(1);
    setFlowState('intro');
  };

  const handleReturnLobby = () => {
    setFlowState('idle');
    setCurrentMode(null);
    setCurrentLevel(0);
    setLobbyVisible(true);
    engineRef.current?.resetLevelProgress();
  };

  const handleIntroStart = () => {
    const id = currentLevel;
    setTaskActive(false);
    setFlowState('task');

    const needsGesture =
      levelConfig?.completionType === 'gesture' && (levelConfig.gestures?.length ?? 0) > 0;
    if (needsGesture) {
      void ensureGestureCamera().catch(() => {
        /* surfaced in task bar */
      });
    }

    engineRef.current?.flyToLevel(id, () => setTaskActive(true));
  };

  const handleIntroSkip = () => {
    const next = currentLevel + 1;
    if (next > totalLevels) setFlowState('outro');
    else {
      setCurrentLevel(next);
      setFlowState('intro');
    }
  };

  const handleTaskComplete = useCallback(() => {
    const id = currentLevel;
    engineRef.current?.completeLevel(id);
    setFlowState('won');
  }, [currentLevel]);

  const handleWonNext = () => {
    const next = currentLevel + 1;
    if (next > totalLevels) setFlowState('outro');
    else {
      setCurrentLevel(next);
      setFlowState('intro');
    }
  };

  const handleWonReplay = () => {
    setTaskActive(false);
    setFlowState('task');

    const needsGesture =
      levelConfig?.completionType === 'gesture' && (levelConfig?.gestures?.length ?? 0) > 0;
    if (needsGesture) {
      void ensureGestureCamera().catch(() => {
        /* surfaced in task bar */
      });
    }

    engineRef.current?.flyToLevel(currentLevel, () => setTaskActive(true));
  };

  const handleOutroRestart = () => {
    engineRef.current?.resetLevelProgress();
    setCurrentLevel(1);
    setFlowState('intro');
  };

  useEffect(() => {
    if (flowState !== 'outro' || !modelReady) return;
    engineRef.current?.playOutroCelebration();
  }, [flowState, modelReady]);

  const appReady = !showLoader && !loadError;
  const handCursorEnabled = appReady && gestureBootStatus !== 'error';

  return (
    <>
      <LoaderOverlay status={loadStatus} error={loadError} visible={showLoader && !loadError} />

      <HandCursorOverlay enabled={handCursorEnabled} />

      {appReady && !handIntroDone && (
        <HandControlIntroModal onContinue={() => setHandIntroDone(true)} />
      )}

      {!lobbyVisible && (
        <div className="language-switcher-floating">
          <LanguageSwitcher />
        </div>
      )}

      <GameViewport containerRef={viewportRef} />

      <LobbyPanel
        ref={panelRef}
        visible={lobbyVisible}
        onSelectMode={handleSelectMode}
      />

      {flowState === 'intro' && levelConfig && (
        <LevelIntroModal
          level={levelConfig}
          totalLevels={totalLevels}
          onStart={handleIntroStart}
          onSkip={handleIntroSkip}
        />
      )}

      {flowState === 'task' && taskActive && levelConfig && modelReady && (
        <LevelTaskBar level={levelConfig} onComplete={handleTaskComplete} />
      )}

      {flowState === 'won' && levelConfig && (
        <LevelWonModal
          level={levelConfig}
          totalLevels={totalLevels}
          onNext={handleWonNext}
          onReplay={handleWonReplay}
        />
      )}

      {flowState === 'outro' && modeConfig && (
        <LevelOutroModal
          text={modeConfig.outro}
          colors={celebrationColors}
          onRestart={handleOutroRestart}
          onLobby={handleReturnLobby}
        />
      )}
    </>
  );
}
