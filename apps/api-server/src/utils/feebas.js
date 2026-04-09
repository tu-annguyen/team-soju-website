const FEEBAS_RESET_INTERVAL_MS = 45 * 60 * 1000;
const FEEBAS_RESET_ANCHOR_ISO = '2026-04-09T20:15:00.000Z';

const ROUTE_119_MAIN_MASK = [
  '001111111100',
  '001111111110',
  '001111111111',
  '001111111111',
  '011111111111',
  '111111111111',
  '111111111111',
  '111111111100',
  '111111110000',
  '000111000000',
];

const FEEBAS_STATUSES = ['unchecked', 'checked', 'pending', 'confirmed'];

function buildTilesFromMask(mask) {
  return mask.flatMap((rowMask, rowIndex) =>
    rowMask.split('').flatMap((value, colIndex) => {
      if (value !== '1') {
        return [];
      }

      return [{
        tileId: `r${rowIndex + 1}c${colIndex + 1}`,
        label: `${String.fromCharCode(65 + rowIndex)}${colIndex + 1}`,
        row: rowIndex,
        col: colIndex,
      }];
    })
  );
}

const FEEBAS_LOCATIONS = {
  'route-119-main': {
    id: 'route-119-main',
    displayName: 'Route 119, Hoenn',
    description: 'Main Route 119 pond tiles for live Feebas coordination.',
    rows: ROUTE_119_MAIN_MASK.length,
    cols: ROUTE_119_MAIN_MASK[0].length,
    tiles: buildTilesFromMask(ROUTE_119_MAIN_MASK),
  },
};

class FeebasRuleError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'FeebasRuleError';
    this.statusCode = statusCode;
  }
}

function getLocationConfig(location) {
  const config = FEEBAS_LOCATIONS[location];

  if (!config) {
    throw new FeebasRuleError('Feebas location not found', 404);
  }

  return config;
}

function getCycleWindow(now = new Date()) {
  const anchorMs = Date.parse(FEEBAS_RESET_ANCHOR_ISO);
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const cycleIndex = Math.floor((nowMs - anchorMs) / FEEBAS_RESET_INTERVAL_MS);
  const cycleStartMs = anchorMs + (cycleIndex * FEEBAS_RESET_INTERVAL_MS);
  const cycleEndMs = cycleStartMs + FEEBAS_RESET_INTERVAL_MS;

  return {
    cycleIndex,
    cycleStart: new Date(cycleStartMs),
    cycleEnd: new Date(cycleEndMs),
  };
}

function sanitizeActorName(name) {
  if (typeof name !== 'string') {
    return null;
  }

  const normalized = name.trim().slice(0, 40);
  return normalized || null;
}

function sanitizeFingerprint(fingerprint) {
  if (typeof fingerprint !== 'string') {
    return null;
  }

  const normalized = fingerprint.trim().slice(0, 120);
  return normalized || null;
}

function validateStatus(status) {
  if (!FEEBAS_STATUSES.includes(status)) {
    throw new FeebasRuleError('Invalid tile status');
  }

  return status;
}

function validateTransition(currentStatus, nextStatus) {
  const allowedTransitions = {
    unchecked: new Set(['checked', 'pending']),
    checked: new Set(['unchecked', 'pending']),
    pending: new Set(['unchecked', 'checked', 'confirmed']),
    confirmed: new Set([]),
  };

  if (!allowedTransitions[currentStatus]?.has(nextStatus)) {
    throw new FeebasRuleError(`Cannot change tile from ${currentStatus} to ${nextStatus}`);
  }
}

module.exports = {
  FEEBAS_LOCATIONS,
  FEEBAS_RESET_ANCHOR_ISO,
  FEEBAS_RESET_INTERVAL_MS,
  FEEBAS_STATUSES,
  FeebasRuleError,
  getLocationConfig,
  getCycleWindow,
  sanitizeActorName,
  sanitizeFingerprint,
  validateStatus,
  validateTransition,
};
