export const DEFAULT_FEEBAS_DISPLAY_MODE_HOTKEY = 'h';
export const FEEBAS_DISPLAY_MODE_HOTKEY_STORAGE_KEY = 'feebas-tile-checker-display-mode-hotkey';

const EDITABLE_ROLES = new Set(['textbox', 'searchbox', 'combobox', 'spinbutton']);

export function normalizeFeebasDisplayModeHotkey(key: string) {
  return key.length === 1 && key.trim() ? key.toLowerCase() : null;
}

export function formatFeebasDisplayModeHotkey(key: string) {
  return key.toUpperCase();
}

export function isFeebasDisplayModeHotkeyEvent(event: KeyboardEvent) {
  return !event.repeat
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.shiftKey
    && normalizeFeebasDisplayModeHotkey(event.key) !== null;
}

export function isEditableHotkeyTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return tagName === 'input'
    || tagName === 'textarea'
    || tagName === 'select'
    || target.isContentEditable
    || EDITABLE_ROLES.has(target.getAttribute('role') || '');
}

export function getStoredFeebasDisplayModeHotkey() {
  try {
    return normalizeFeebasDisplayModeHotkey(
      localStorage.getItem(FEEBAS_DISPLAY_MODE_HOTKEY_STORAGE_KEY) || ''
    ) || DEFAULT_FEEBAS_DISPLAY_MODE_HOTKEY;
  } catch {
    return DEFAULT_FEEBAS_DISPLAY_MODE_HOTKEY;
  }
}

export function storeFeebasDisplayModeHotkey(hotkey: string) {
  try {
    localStorage.setItem(FEEBAS_DISPLAY_MODE_HOTKEY_STORAGE_KEY, hotkey);
  } catch {
    // Ignore storage write failures; the active session still keeps the hotkey.
  }
}
