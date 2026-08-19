import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameMode, LevelFlowState, LevelsConfig } from '@/types/levels';
import { getLevelConfig, getModeConfig, loadLevelsConfig } from '@/lib/levels';
import { createGameEngine, type GameEngine } from '@/game/createGameEngine';
import { LoaderOverlay } from '@/components/LoaderOverlay';
import { useGestureRecognizerBoot } from '@/hooks/useGestureRecognizer';
import { GameViewport } from '@/components/GameViewport';
import { LobbyPanel } from '@/components/LobbyPanel';
import { LevelIntroModal } from '@/components/LevelIntroModal';
import { LevelTaskBar } from '@/components/LevelTaskBar';
import { LevelWonModal } from '@/components/LevelWonModal';
import { LevelOutroModal } from '@/components/LevelOutroModal';
import './App.css';

import type { GestureRecognizerStatus } from '@/hooks/useGestureRecognizer';

function mergeLoadStatus(modelText: string, gestureStatus: GestureRecognizerStatus): string {
  const parts = [modelText];
  if (gestureStatus === 'loading') parts.push('Loading gesture model…');
  else if (gestureStatus === 'error') parts.push('Gesture unavailable');
  return parts.join(' · ');
}

export default function App() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [levelsConfig, setLevelsConfig] = useState<LevelsConfig | null>(null);
  const [loadStatus, setLoadStatus] = useState('Loading…');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [showLoader, setShowLoader] = useState(true);

  const { bootStatus: gestureBootStatus } = useGestureRecognizerBoot();
  const gestureBootDone = gestureBootStatus === 'ready' || gestureBootStatus === 'error';
  const modelProgressRef = useRef('Loading…');
  const gestureBootStatusRef = useRef(gestureBootStatus);
  gestureBootStatusRef.current = gestureBootStatus;

  const [lobbyVisible, setLobbyVisible] = useState(true);
  const [currentMode, setCurrentMode] = useState<GameMode | null>(null);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [flowState, setFlowState] = useState<LevelFlowState>('idle');
  const [taskActive, setTaskActive] = useState(false);

  useEffect(() => {
    void loadLevelsConfig().then(setLevelsConfig);
  }, []);

  const updateLoadStatus = useCallback(() => {
    setLoadStatus(mergeLoadStatus(modelProgressRef.current, gestureBootStatus));
  }, [gestureBootStatus]);

  useEffect(() => {
    updateLoadStatus();
  }, [updateLoadStatus]);

  useEffect(() => {
    if (modelReady && gestureBootDone && !loadError) {
      setLoadStatus('Ready');
      window.setTimeout(() => setShowLoader(false), 200);
    }
  }, [modelReady, gestureBootDone, loadError]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const engine = createGameEngine(el, {
      onLoadProgress: (_bytes, text) => {
        modelProgressRef.current = text;
        setLoadStatus(mergeLoadStatus(text, gestureBootStatusRef.current));
      },
      onLoadComplete: () => {
        setModelReady(true);
      },
      onLoadError: (err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load 3D model';
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

  const handleSelectMode = (mode: GameMode) => {
    if (!levelsConfig) {
      alert('Failed to load levels config. 请通过 dev server 打开页面。');
      return;
    }
    setCurrentMode(mode);
    setLobbyVisible(false);
    setCurrentLevel(1);
    setFlowState('intro');
  };

  const handleLobbyClose = () => {
    setLobbyVisible(false);
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
    engineRef.current?.flyToLevel(currentLevel, () => setTaskActive(true));
  };

  const handleOutroRestart = () => {
    engineRef.current?.resetLevelProgress();
    setCurrentLevel(1);
    setFlowState('intro');
  };

  return (
    <>
      <LoaderOverlay status={loadStatus} error={loadError} visible={showLoader && !loadError} />

      <GameViewport containerRef={viewportRef} />

      <LobbyPanel
        ref={panelRef}
        visible={lobbyVisible}
        onSelectMode={handleSelectMode}
        onClose={handleLobbyClose}
        onToggleGui={() => {}}
      />

      {flowState !== 'idle' && flowState !== 'outro' && (
        <button className="lobby-home" type="button" aria-label="Back to lobby" onClick={handleReturnLobby}>
          <span aria-hidden="true">🏠</span> 主菜单
        </button>
      )}

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
          onRestart={handleOutroRestart}
          onLobby={handleReturnLobby}
        />
      )}
    </>
  );
}
