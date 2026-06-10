import { useEffect, useState } from 'react';
import {
  DEFAULT_FEEBAS_DISPLAY_MODE_HOTKEY,
  getStoredFeebasDisplayModeHotkey,
  isEditableHotkeyTarget,
  isFeebasDisplayModeHotkeyEvent,
  normalizeFeebasDisplayModeHotkey,
  storeFeebasDisplayModeHotkey,
} from '../../utils/feebasHotkey';
import type { BoardDisplayMode, FeebasCheckerMessages } from './shared';

export function useFeebasDisplayModeState(messages: FeebasCheckerMessages) {
  const [displayMode, setDisplayMode] = useState<BoardDisplayMode>('voting');
  const [displayModeHotkey, setDisplayModeHotkey] = useState(getStoredFeebasDisplayModeHotkey);
  const [isHotkeyCaptureActive, setIsHotkeyCaptureActive] = useState(false);
  const [hotkeyCaptureError, setHotkeyCaptureError] = useState<string | null>(null);

  const saveDisplayModeHotkey = (nextHotkey: string) => {
    setDisplayModeHotkey(nextHotkey);
    storeFeebasDisplayModeHotkey(nextHotkey);
  };

  const startHotkeyCapture = () => {
    setIsHotkeyCaptureActive(true);
    setHotkeyCaptureError(null);
  };

  const resetDisplayModeHotkey = () => {
    saveDisplayModeHotkey(DEFAULT_FEEBAS_DISPLAY_MODE_HOTKEY);
    setIsHotkeyCaptureActive(false);
    setHotkeyCaptureError(null);
  };

  useEffect(() => {
    const handleDisplayModeHotkey = (event: KeyboardEvent) => {
      if (isHotkeyCaptureActive) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setIsHotkeyCaptureActive(false);
          setHotkeyCaptureError(null);
          return;
        }

        if (!isFeebasDisplayModeHotkeyEvent(event)) {
          event.preventDefault();
          setHotkeyCaptureError(messages.heatmap.invalidShortcut);
          return;
        }

        const nextHotkey = normalizeFeebasDisplayModeHotkey(event.key);

        if (nextHotkey) {
          event.preventDefault();
          saveDisplayModeHotkey(nextHotkey);
          setIsHotkeyCaptureActive(false);
          setHotkeyCaptureError(null);
        }

        return;
      }

      if (!isFeebasDisplayModeHotkeyEvent(event) || isEditableHotkeyTarget(event.target)) return;
      if (normalizeFeebasDisplayModeHotkey(event.key) !== displayModeHotkey) return;

      setDisplayMode((currentMode) => (currentMode === 'voting' ? 'heatmap' : 'voting'));
    };

    window.addEventListener('keydown', handleDisplayModeHotkey);

    return () => {
      window.removeEventListener('keydown', handleDisplayModeHotkey);
    };
  }, [displayModeHotkey, isHotkeyCaptureActive, messages.heatmap.invalidShortcut]);

  return {
    displayMode,
    displayModeHotkey,
    hotkeyCaptureError,
    isHotkeyCaptureActive,
    resetDisplayModeHotkey,
    setDisplayMode,
    startHotkeyCapture,
  };
}
