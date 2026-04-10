const FEEBAS_RESET_INTERVAL_MS = 45 * 60 * 1000;
const FEEBAS_RESET_ANCHOR_ISO = '2026-04-09T20:15:00.000Z';

const ROUTE_119_MAIN_MASK = [
  '0000000100000000000',
  '0000000100000000000',
  '0000000111001100110',
  '0000000111111111110',
  '0000000111111111110',
  '0000000111111111110',
  '0000000111111111111',
  '0000000111111111111',
  '0011111111111100111',
  '1111111111111100111',
  '0011111111111111111',
  '0011111111111111100',
  '0111111111111000000',
  '0111110000000000000',
  '1100000000000000000',
];

const FEEBAS_STATUSES = ['unchecked', 'checked', 'pending', 'confirmed'];
const FEEBAS_VOTABLE_STATUSES = ['checked', 'pending', 'confirmed'];

function buildTilesFromMask(mask) {
  const totalRows = mask.length;

  return mask.flatMap((rowMask, rowIndex) =>
    rowMask.split('').flatMap((value, colIndex) => {
      if (value !== '1') {
        return [];
      }

      return [{
        tileId: `r${rowIndex + 1}c${colIndex + 1}`,
        label: `${String.fromCharCode(65 + colIndex)}${totalRows - rowIndex}`,
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

module.exports = {
  FEEBAS_LOCATIONS,
  FEEBAS_RESET_ANCHOR_ISO,
  FEEBAS_RESET_INTERVAL_MS,
  FEEBAS_STATUSES,
  FEEBAS_VOTABLE_STATUSES,
  FeebasRuleError,
  getLocationConfig,
  getCycleWindow,
  sanitizeActorName,
  sanitizeFingerprint,
  validateStatus,
};
