const NATURES = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
  'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
  'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky',
];

const NUMERIC_TEMPLATES = {
  '0': ['0001111111111000','0001111111111000','0001111111111000','1110000000000111','1110000000000111','1110000000000111','1110000000000111','1110000000000111','1110000000000111','1110001111000111','1110001111000111','1110000000000111','1110000000000111','1110000000000111','1110000000000111','1110000000000111','1110000000000111','0001111111111000','0001111111111000','0001111111111000'],
  '1': ['0000011111100000','0000011111100000','0000011111100000','1111111111100000','1111111111100000','1111111111100000','0000011111100000','0000011111100000','0000011111100000','0000011111100000','0000011111100000','0000011111100000','0000011111100000','0000011111100000','0000011111100000','0000011111100000','0000011111100000','1111111111111111','1111111111111111','1111111111111111'],
  '2': ['0001111111111000','0001111111111000','0001111111111000','1110000000000111','1110000000000111','1110000000000111','0000000000000111','0000000000000111','0000000000000111','0001111111111000','0001111111111000','1110000000000000','1110000000000000','1110000000000000','1110000000000000','1110000000000000','1110000000000000','1111111111111111','1111111111111111','1111111111111111'],
  '3': ['0001111111111000','0001111111111000','0001111111111000','1110000000000111','1110000000000111','1110000000000111','0000000000000111','0000000000000111','0000000000000111','0001111111111000','0001111111111000','0000000000000111','0000000000000111','0000000000000111','1110000000000111','1110000000000111','1110000000000111','0001111111111000','0001111111111000','0001111111111000'],
  '4': ['0000000000000111','0000000000000111','0000000000000111','0000000000111111','0000000000111111','0000000000111111','0000001111000111','0000001111000111','0000001111000111','0001110000000111','0001110000000111','1111111111111111','1111111111111111','1111111111111111','0000000000000111','0000000000000111','0000000000000111','0000000000000111','0000000000000111','0000000000000111'],
  '5': ['1111111111111111','1111111111111111','1111111111111111','1110000000000000','1110000000000000','1110000000000000','1110000000000000','1110000000000000','1110000000000000','1111111111111000','1111111111111000','0000000000000111','0000000000000111','0000000000000111','1110000000000111','1110000000000111','1110000000000111','0001111111111000','0001111111111000','0001111111111000'],
  '6': ['0001111111111000','0001111111111000','0001111111111000','1110000000000111','1110000000000111','1110000000000111','1110000000000000','1110000000000000','1110000000000000','1111111111111000','1111111111111000','1110000000000111','1110000000000111','1110000000000111','1110000000000111','1110000000000111','1110000000000111','0001111111111000','0001111111111000','0001111111111000'],
  '7': ['1111111111111111','1111111111111111','1111111111111111','0000000000000111','0000000000000111','0000000000000111','0000000000111000','0000000000111000','0000000000111000','0000001111000000','0000001111000000','0001110000000000','0001110000000000','0001110000000000','1110000000000000','1110000000000000','1110000000000000','1110000000000000','1110000000000000','1110000000000000'],
  '8': ['0001111111111000','0001111111111000','0001111111111000','1110000000000111','1110000000000111','1110000000000111','1110000000000111','1110000000000111','1110000000000111','0001111111111000','0001111111111000','1110000000000111','1110000000000111','1110000000000111','1110000000000111','1110000000000111','1110000000000111','0001111111111000','0001111111111000','0001111111111000'],
  '9': ['0001111111111000','0001111111111000','0001111111111000','1110000000000111','1110000000000111','1110000000000111','1110000000000111','1110000000000111','1110000000000111','0001111111111111','0001111111111111','0000000000000111','0000000000000111','0000000000000111','1110000000000111','1110000000000111','1110000000000111','0001111111111000','0001111111111000','0001111111111000'],
  '/': ['0000000000000111','0000000000000111','0000000000000111','0000000000000111','0000000000000111','0000000000000111','0000000000111000','0000000000111000','0000000000111000','0000001111000000','0000001111000000','0001110000000000','0001110000000000','0001110000000000','1110000000000000','1110000000000000','1110000000000000','1110000000000000','1110000000000000','1110000000000000'],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeNumericOcrValue(text) {
  return String(text || '')
    .replace(/[|!Il]/g, '1')
    .replace(/[Oo]/g, '0')
    .replace(/[Ss]/g, '5')
    .replace(/[£€]/g, '2')
    .replace(/[°•]/g, '/')
    .replace(/[;,]/g, ':')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAlphaOcrValue(text) {
  return String(text || '')
    .replace(/[|]/g, 'l')
    .replace(/[0]/g, 'O')
    .replace(/[1]/g, 'l')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEncounterOcrValue(text) {
  return String(text || '')
    .replace(/[|]/g, 'l')
    .replace(/[;]/g, ':')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  const rows = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) rows[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost
      );
    }
  }

  return rows[left.length][right.length];
}

async function getImageMetadata(sharp, imageBuffer) {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    throw new Error('Unable to read screenshot dimensions for mobile stats parsing.');
  }

  return { width, height };
}

async function getRawImage(sharp, imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, info };
}

function pixelOffset(width, channels, x, y) {
  return ((y * width) + x) * channels;
}

function isTextForeground(r, g, b) {
  const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
  const isBright = luminance >= 150;
  const isGreen = g >= 110 && g >= (r + 15) && g >= (b + 15);
  const isRed = r >= 110 && r >= (g + 15) && r >= (b + 15);
  return isBright || isGreen || isRed;
}

function buildFooterMask(data, info, footerTop) {
  const footerHeight = info.height - footerTop;
  const mask = Array.from({ length: footerHeight }, () => new Uint8Array(info.width));

  for (let y = footerTop; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = pixelOffset(info.width, info.channels, x, y);
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      mask[y - footerTop][x] = isTextForeground(r, g, b) ? 1 : 0;
    }
  }

  return mask;
}

function sumRow(mask, row, left = 0, right = mask[0].length - 1) {
  let total = 0;
  for (let x = left; x <= right; x += 1) total += mask[row][x];
  return total;
}

function sumColumn(mask, col, top = 0, bottom = mask.length - 1) {
  let total = 0;
  for (let y = top; y <= bottom; y += 1) total += mask[y][col];
  return total;
}

function findGroups(length, measure, minValue, minSpan) {
  const groups = [];
  let start = -1;

  for (let index = 0; index < length; index += 1) {
    const active = measure(index) >= minValue;
    if (active && start === -1) {
      start = index;
      continue;
    }

    if (!active && start !== -1) {
      if ((index - start) >= minSpan) {
        groups.push({ start, end: index - 1 });
      }
      start = -1;
    }
  }

  if (start !== -1 && (length - start) >= minSpan) {
    groups.push({ start, end: length - 1 });
  }

  return groups;
}

function findFooterTop(data, info) {
  const startY = Math.floor(info.height * 0.70);
  const endY = Math.floor(info.height * 0.95);
  let bestY = Math.floor(info.height * 0.78);
  let bestContrast = Number.NEGATIVE_INFINITY;

  const rowMean = (y) => {
    let total = 0;
    for (let x = 0; x < info.width; x += 1) {
      const offset = pixelOffset(info.width, info.channels, x, y);
      total += (0.299 * data[offset]) + (0.587 * data[offset + 1]) + (0.114 * data[offset + 2]);
    }
    return total / info.width;
  };

  for (let y = startY; y < endY; y += 1) {
    const before = rowMean(Math.max(0, y - 3));
    const after = rowMean(Math.min(info.height - 1, y + 3));
    const contrast = before - after;
    if (contrast > bestContrast) {
      bestContrast = contrast;
      bestY = y;
    }
  }

  return clamp(bestY, Math.floor(info.height * 0.72), Math.floor(info.height * 0.84));
}

function findRowGroups(mask) {
  const width = mask[0].length;
  const minRowPixels = Math.max(8, Math.floor(width * 0.01));
  const groups = findGroups(
    mask.length,
    (row) => sumRow(mask, row),
    minRowPixels,
    10
  );

  return groups.slice(0, 2);
}

function findColumnBlocks(mask, rowGroup) {
  const width = mask[0].length;
  const rowHeight = rowGroup.end - rowGroup.start + 1;
  const minColumnPixels = Math.max(3, Math.floor(rowHeight * 0.12));
  const groups = findGroups(
    width,
    (col) => sumColumn(mask, col, rowGroup.start, rowGroup.end),
    minColumnPixels,
    2
  );

  const mergeGap = Math.max(18, Math.floor(width * 0.012));
  const merged = [];

  for (const group of groups) {
    const previous = merged.at(-1);
    if (previous && (group.start - previous.end) <= mergeGap) {
      previous.end = group.end;
      continue;
    }

    merged.push({ ...group });
  }

  if (merged.length <= 2) return merged;

  const sorted = merged
    .map((group) => ({ ...group, width: group.end - group.start + 1 }))
    .sort((a, b) => b.width - a.width)
    .slice(0, 2)
    .sort((a, b) => a.start - b.start);

  return sorted;
}

function expandRect(rect, imageWidth, imageHeight, padX, padY) {
  const left = clamp(rect.left - padX, 0, imageWidth - 1);
  const top = clamp(rect.top - padY, 0, imageHeight - 1);
  const right = clamp(rect.left + rect.width + padX, left + 1, imageWidth);
  const bottom = clamp(rect.top + rect.height + padY, top + 1, imageHeight);

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

function anchorRectFromGroup(group, rowGroup, footerTop, imageWidth, imageHeight, kind) {
  const baseRect = {
    left: group.start,
    top: footerTop + rowGroup.start,
    width: group.end - group.start + 1,
    height: rowGroup.end - rowGroup.start + 1,
  };

  if (kind === 'left') {
    return expandRect(baseRect, imageWidth, imageHeight, 28, 12);
  }

  return expandRect(baseRect, imageWidth, imageHeight, 24, 12);
}

function buildFallbackBlocks(imageWidth, imageHeight, footerTop) {
  const footerHeight = imageHeight - footerTop;
  const rowHeight = Math.max(32, Math.floor(footerHeight * 0.22));
  const row1Top = footerTop + Math.max(8, Math.floor(footerHeight * 0.28));
  const row2Top = footerTop + Math.max(28, Math.floor(footerHeight * 0.56));

  return {
    ivs: expandRect({
      left: Math.floor(imageWidth * 0.06),
      top: row1Top,
      width: Math.floor(imageWidth * 0.30),
      height: rowHeight,
    }, imageWidth, imageHeight, 20, 10),
    totalEncounters: expandRect({
      left: Math.floor(imageWidth * 0.47),
      top: row1Top,
      width: Math.floor(imageWidth * 0.30),
      height: rowHeight,
    }, imageWidth, imageHeight, 20, 10),
    nature: expandRect({
      left: Math.floor(imageWidth * 0.06),
      top: row2Top,
      width: Math.floor(imageWidth * 0.30),
      height: rowHeight,
    }, imageWidth, imageHeight, 20, 10),
    speciesEncounters: expandRect({
      left: Math.floor(imageWidth * 0.47),
      top: row2Top,
      width: Math.floor(imageWidth * 0.30),
      height: rowHeight,
    }, imageWidth, imageHeight, 20, 10),
  };
}

function buildTextMaskForRect(data, info, rect) {
  const rows = [];

  for (let y = 0; y < rect.height; y += 1) {
    const row = new Uint8Array(rect.width);
    for (let x = 0; x < rect.width; x += 1) {
      const offset = pixelOffset(info.width, info.channels, rect.left + x, rect.top + y);
      row[x] = isTextForeground(data[offset], data[offset + 1], data[offset + 2]) ? 1 : 0;
    }
    rows.push(row);
  }

  return rows;
}

function trimMaskBounds(mask) {
  const height = mask.length;
  const width = mask[0].length;
  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;

  const rowInk = (row) => sumRow(mask, row) > 0;
  const colInk = (col) => sumColumn(mask, col) > 0;

  while (top <= bottom && !rowInk(top)) top += 1;
  while (bottom >= top && !rowInk(bottom)) bottom -= 1;
  while (left <= right && !colInk(left)) left += 1;
  while (right >= left && !colInk(right)) right -= 1;

  if (top > bottom || left > right) {
    return null;
  }

  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function cropMask(mask, rect) {
  const cropped = [];
  for (let y = rect.top; y < rect.top + rect.height; y += 1) {
    cropped.push(mask[y].slice(rect.left, rect.left + rect.width));
  }
  return cropped;
}

function findGlyphGroups(mask) {
  const width = mask[0].length;
  const height = mask.length;
  const groups = findGroups(width, (col) => sumColumn(mask, col), Math.max(1, Math.floor(height * 0.08)), 1);
  const merged = [];

  for (const group of groups) {
    const previous = merged.at(-1);
    if (previous && (group.start - previous.end) <= 2) {
      previous.end = group.end;
      continue;
    }
    merged.push({ ...group });
  }

  return merged;
}

function normalizeGlyphMask(mask, outWidth = 16, outHeight = 20) {
  const bounds = trimMaskBounds(mask);
  if (!bounds) return null;

  const source = cropMask(mask, bounds);
  const sourceHeight = source.length;
  const sourceWidth = source[0].length;
  const output = [];

  for (let y = 0; y < outHeight; y += 1) {
    let row = '';
    for (let x = 0; x < outWidth; x += 1) {
      const srcX = Math.min(sourceWidth - 1, Math.floor((x / outWidth) * sourceWidth));
      const srcY = Math.min(sourceHeight - 1, Math.floor((y / outHeight) * sourceHeight));
      row += source[srcY][srcX] ? '1' : '0';
    }
    output.push(row);
  }

  return output;
}

function scoreTemplate(candidate, template) {
  let matches = 0;
  let total = 0;

  for (let y = 0; y < candidate.length; y += 1) {
    for (let x = 0; x < candidate[y].length; x += 1) {
      if (candidate[y][x] === template[y][x]) matches += 1;
      total += 1;
    }
  }

  return total === 0 ? 0 : matches / total;
}

function matchGlyphToTemplate(mask, allowedChars, minimumScore = 0.58) {
  const normalized = normalizeGlyphMask(mask);
  if (!normalized) return null;

  let bestChar = null;
  let bestScore = 0;

  for (const char of allowedChars) {
    const template = NUMERIC_TEMPLATES[char];
    if (!template) continue;

    const score = scoreTemplate(normalized, template);
    if (score > bestScore) {
      bestScore = score;
      bestChar = char;
    }
  }

  if (!bestChar || bestScore < minimumScore) return null;
  return { char: bestChar, score: bestScore };
}

function recognizeNumericSequence(mask, allowedChars, minimumScore = 0.58) {
  const glyphGroups = findGlyphGroups(mask);
  const recognized = [];

  for (const group of glyphGroups) {
    const glyphMask = cropMask(mask, {
      left: group.start,
      top: 0,
      width: group.end - group.start + 1,
      height: mask.length,
    });

    const match = matchGlyphToTemplate(glyphMask, allowedChars, minimumScore);
    if (!match) continue;

    recognized.push({
      ...match,
      start: group.start,
      end: group.end,
    });
  }

  return recognized;
}

function findRightmostInkRect(mask, baseRect, imageWidth, imageHeight) {
  const width = mask[0].length;
  const height = mask.length;
  const minColumnPixels = Math.max(2, Math.floor(height * 0.10));
  const groups = findGroups(
    width,
    (col) => sumColumn(mask, col),
    minColumnPixels,
    2
  );

  if (groups.length === 0) return null;

  const mergeGap = Math.max(8, Math.floor(width * 0.02));
  const merged = [];

  for (const group of groups) {
    const previous = merged.at(-1);
    if (previous && (group.start - previous.end) <= mergeGap) {
      previous.end = group.end;
      continue;
    }
    merged.push({ ...group });
  }

  const rightmost = merged.at(-1);
  if (!rightmost) return null;

  return expandRect({
    left: baseRect.left + rightmost.start,
    top: baseRect.top,
    width: rightmost.end - rightmost.start + 1,
    height: baseRect.height,
  }, imageWidth, imageHeight, 10, 6);
}

function buildTrailingFractionRect(baseRect, imageWidth, imageHeight, fraction) {
  const width = Math.max(1, Math.floor(baseRect.width * fraction));
  return expandRect({
    left: baseRect.left + (baseRect.width - width),
    top: baseRect.top,
    width,
    height: baseRect.height,
  }, imageWidth, imageHeight, 12, 6);
}

function pickValueRect(preferredRect, fallbackRect) {
  if (!preferredRect) return fallbackRect;
  if (preferredRect.width < Math.floor(fallbackRect.width * 0.45)) return fallbackRect;
  return preferredRect;
}

function deriveValueRects(blocks, data, info) {
  const ivs = expandRect({
    left: blocks.ivs.left + Math.floor(blocks.ivs.width * 0.05),
    top: blocks.ivs.top,
    width: Math.floor(blocks.ivs.width * 0.90),
    height: blocks.ivs.height,
  }, info.width, info.height, 8, 4);

  const nature = expandRect({
    left: blocks.nature.left + Math.floor(blocks.nature.width * 0.18),
    top: blocks.nature.top,
    width: Math.floor(blocks.nature.width * 0.62),
    height: blocks.nature.height,
  }, info.width, info.height, 8, 4);

  const totalMask = buildTextMaskForRect(data, info, blocks.totalEncounters);
  const speciesMask = buildTextMaskForRect(data, info, blocks.speciesEncounters);
  const totalFallback = buildTrailingFractionRect(blocks.totalEncounters, info.width, info.height, 0.72);
  const speciesFallback = buildTrailingFractionRect(blocks.speciesEncounters, info.width, info.height, 0.64);

  return {
    ivs,
    nature,
    totalEncountersValue: pickValueRect(
      findRightmostInkRect(totalMask, blocks.totalEncounters, info.width, info.height),
      totalFallback
    ),
    speciesEncountersValue: pickValueRect(
      findRightmostInkRect(speciesMask, blocks.speciesEncounters, info.width, info.height),
      speciesFallback
    ),
    totalEncountersBlock: blocks.totalEncounters,
    speciesEncountersBlock: blocks.speciesEncounters,
  };
}

async function buildRegionVariantBuffers({ sharp, imageBuffer, rect, mode = 'numeric' }) {
  const variants = [];
  const resizeWidth = Math.max(rect.width * 5, 900);

  const buildBase = () => sharp(imageBuffer)
    .extract(rect)
    .greyscale()
    .normalize()
    .resize({ width: resizeWidth, kernel: sharp.kernel.nearest });

  if (mode === 'numeric') {
    variants.push({
      name: 'threshold-150',
      buffer: await buildBase().clone().negate().threshold(150).png().toBuffer(),
    });
    variants.push({
      name: 'threshold-180',
      buffer: await buildBase().clone().negate().threshold(180).png().toBuffer(),
    });
  } else {
    variants.push({
      name: 'alpha-normalized',
      buffer: await buildBase().clone().png().toBuffer(),
    });
    variants.push({
      name: 'alpha-threshold',
      buffer: await buildBase().clone().threshold(165).png().toBuffer(),
    });
  }

  return { rect, variants };
}

async function recognizeTextVariants(Tesseract, variants, whitelist, normalizeText, psm = '7') {
  const results = [];

  for (const variant of variants) {
    const result = await Tesseract.recognize(variant.buffer, 'eng', {
      tessedit_pageseg_mode: psm,
      preserve_interword_spaces: '1',
      tessedit_char_whitelist: whitelist,
      user_defined_dpi: '300',
    });

    results.push({
      name: variant.name,
      text: normalizeText(result?.data?.text || ''),
    });
  }

  return results;
}

function parseIvCandidate(text) {
  const compact = text.replace(/\s+/g, '');
  const match = compact
    .replace(/[^0-9/:]/g, '')
    .match(/(?:IVs:)?((?:3[01]|[12]?\d)\/(?:3[01]|[12]?\d)\/(?:3[01]|[12]?\d)\/(?:3[01]|[12]?\d)\/(?:3[01]|[12]?\d)\/(?:3[01]|[12]?\d))/i);

  if (!match?.[1]) return null;

  const values = match[1].split('/').map((value) => parseInt(value, 10));
  if (values.some((value) => Number.isNaN(value) || value < 0 || value > 31)) return null;

  return {
    value: values,
    confidence: 0.95,
    strategy: 'anchor-ocr',
    raw: text,
  };
}

function parseNatureCandidate(text) {
  const tokens = text
    .split(/[^A-Za-z]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return null;

  let bestMatch = null;

  for (const token of tokens) {
    for (const nature of NATURES) {
      const distance = levenshtein(token, nature);
      const maxLength = Math.max(token.length, nature.length);
      const confidence = maxLength === 0 ? 0 : Math.max(0, 1 - (distance / maxLength));

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = {
          value: nature,
          confidence,
          raw: token,
        };
      }
    }
  }

  if (!bestMatch || bestMatch.confidence < 0.45) return null;

  return {
    value: bestMatch.value,
    confidence: bestMatch.confidence,
    strategy: 'anchor-ocr-dictionary',
    raw: bestMatch.raw,
  };
}

function chooseBest(results, parser) {
  let best = null;

  for (const result of results) {
    const parsed = parser(result.text);
    if (!parsed) continue;

    if (!best || parsed.confidence > best.confidence) {
      best = {
        ...parsed,
        variant: result.name,
      };
    }
  }

  return best || {
    value: null,
    confidence: 0,
    strategy: 'anchor-ocr',
    raw: results.map((result) => `${result.name}:${result.text}`).join(' | '),
  };
}

function normalizeLabelToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function buildEncounterLabelPatterns(kind, pokemonName) {
  if (kind === 'total') {
    return [
      /total\s+encounters?\s*:?\s*([a-z0-9]{3,7})/i,
      /total\s*[a-z]*\s*encounters?\s*:?\s*([a-z0-9]{3,7})/i,
      /encounters?\s*:?\s*([a-z0-9]{3,7})/i,
    ];
  }

  const normalizedPokemon = normalizeLabelToken(pokemonName);
  const escapedPokemon = normalizedPokemon ? normalizedPokemon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;

  return [
    ...(escapedPokemon ? [
      new RegExp(`${escapedPokemon}\\s*encounters?\\s*:?(?:\\s*)([a-z0-9]{3,7})`, 'i'),
      new RegExp(`${escapedPokemon}[a-z]*\\s*encounters?\\s*:?(?:\\s*)([a-z0-9]{3,7})`, 'i'),
    ] : []),
    /encounters?\s*:?\s*([a-z0-9]{3,7})/i,
  ];
}

function parseEncounterCountCandidate(text, kind, pokemonName) {
  const compact = normalizeEncounterOcrValue(text);
  if (!compact) return null;

  const alphaNormalized = compact
    .toLowerCase()
    .replace(/[^a-z0-9: ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const compactNormalized = alphaNormalized.replace(/\s+/g, '');

  const parseRawCountToken = (value) => {
    const rawToken = String(value || '');
    const normalizedDigits = rawToken
      .replace(/[Oo]/g, '0')
      .replace(/[Il]/g, '1')
      .replace(/[Zz]/g, '2')
      .replace(/[Ss]/g, '5')
      .replace(/[Bb]/g, '8')
      .replace(/[^0-9]/g, '');

    if (!/^\d{3,7}$/.test(normalizedDigits)) return null;
    const parsedValue = parseInt(normalizedDigits, 10);
    if (Number.isNaN(parsedValue)) return null;

    const originalLength = rawToken.replace(/\s+/g, '').length;
    const normalizedLength = normalizedDigits.length;
    const discardedCount = Math.max(0, originalLength - normalizedLength);
    const ambiguousCount = (rawToken.match(/[A-Za-z]/g) || []).length;
    const qualityPenalty = (discardedCount * 0.14) + (ambiguousCount * 0.08);

    return {
      value: parsedValue,
      normalizedLength,
      discardedCount,
      ambiguousCount,
      qualityPenalty,
    };
  };

  for (const pattern of buildEncounterLabelPatterns(kind, pokemonName)) {
    const match = pattern.exec(alphaNormalized) || pattern.exec(compactNormalized);
    if (!match?.[1]) continue;

    const parsedToken = parseRawCountToken(match[1]);
    if (!parsedToken || !Number.isInteger(parsedToken.value) || parsedToken.value < 0) continue;

    const hasStrongLabel = kind === 'total'
      ? /total/.test(alphaNormalized)
      : new RegExp(normalizeLabelToken(pokemonName || ''), 'i').test(compactNormalized);
    const baseConfidence = hasStrongLabel ? 0.9 : 0.72;
    const confidence = Math.max(0.35, baseConfidence - parsedToken.qualityPenalty);

    return {
      value: parsedToken.value,
      confidence,
      strategy: 'anchor-ocr-labeled',
      raw: compact,
    };
  }

  return null;
}

async function recognizeIvBlock({ sharp, Tesseract, imageBuffer, rect }) {
  const { data, info } = await getRawImage(sharp, imageBuffer);
  const mask = buildTextMaskForRect(data, info, rect);
  const recognized = recognizeNumericSequence(mask, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '/'], 0.58);
  const text = recognized.map((item) => item.char).join('');
  const parsed = parseIvCandidate(text);

  return {
    rect,
    value: parsed?.value || null,
    confidence: parsed ? Math.min(...recognized.map((item) => item.score)) : 0,
    strategy: 'anchor-template',
    raw: text,
    variant: 'battle-template',
    variants: recognized,
  };
}

async function recognizeNatureBlock({ sharp, Tesseract, imageBuffer, rect }) {
  const payload = await buildRegionVariantBuffers({ sharp, imageBuffer, rect, mode: 'alpha' });
  const results = await recognizeTextVariants(
    Tesseract,
    payload.variants,
    'Nature:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    normalizeAlphaOcrValue,
    '7'
  );
  return {
    rect: payload.rect,
    ...chooseBest(results, parseNatureCandidate),
    variants: results,
  };
}

async function recognizeEncounterRowBlock({ sharp, Tesseract, imageBuffer, rect, kind, pokemonName }) {
  const payload = await buildRegionVariantBuffers({ sharp, imageBuffer, rect, mode: 'alpha' });
  const results = await recognizeTextVariants(
    Tesseract,
    payload.variants,
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789: ',
    normalizeEncounterOcrValue,
    '7'
  );

  const best = chooseBest(results, (text) => parseEncounterCountCandidate(text, kind, pokemonName));
  return {
    rect: payload.rect,
    ...best,
    variants: results,
    debugCandidates: results.map((result) => ({
      source: 'ocr-row',
      variant: result.name,
      text: result.text,
      parsed: parseEncounterCountCandidate(result.text, kind, pokemonName),
    })),
  };
}

function parseCountFromRecognized(recognized) {
  const digits = recognized.filter((item) => /\d/.test(item.char));
  if (digits.length === 0) return null;

  const sorted = [...digits].sort((a, b) => a.start - b.start);
  const runs = [];
  let currentRun = [];
  for (const digit of sorted) {
    const previous = currentRun.at(-1);
    if (!previous || (digit.start - previous.end) <= 24) {
      currentRun.push(digit);
    } else {
      runs.push(currentRun);
      currentRun = [digit];
    }
  }
  if (currentRun.length > 0) runs.push(currentRun);

  if (runs.length === 0) return null;

  const maxEnd = Math.max(...runs.map((run) => run.at(-1).end));
  const scoreRun = (run) => {
    const rightEdgeRatio = maxEnd === 0 ? 0 : run.at(-1).end / maxEnd;
    const minScore = Math.min(...run.map((item) => item.score));
    const gaps = run.slice(1).map((item, index) => item.start - run[index].end);
    const averageGap = gaps.length > 0 ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 0;
    const gapVariance = gaps.length > 1
      ? gaps.reduce((sum, gap) => sum + Math.abs(gap - averageGap), 0) / gaps.length
      : 0;
    const gapConsistency = gaps.length === 0 ? 1 : Math.max(0, 1 - (gapVariance / 12));
    const lengthBonus = Math.min(1, run.length / 4);

    return (
      (rightEdgeRatio * 0.45) +
      (minScore * 0.30) +
      (gapConsistency * 0.15) +
      (lengthBonus * 0.10)
    );
  };

  const bestRun = runs
    .map((run) => ({ run, runScore: scoreRun(run) }))
    .sort((a, b) => b.runScore - a.runScore)[0]?.run;

  if (!bestRun || bestRun.length === 0) return null;

  const text = bestRun.map((item) => item.char).join('');
  if (!/^\d{3,7}$/.test(text)) return null;
  const minScore = Math.min(...bestRun.map((item) => item.score));
  const runScore = scoreRun(bestRun);
  if (runScore < 0.62) return null;

  return {
    value: parseInt(text, 10),
    confidence: Math.min(0.99, (minScore * 0.6) + (runScore * 0.4)),
    raw: text,
  };
}

function recognizeCountFromMask(mask, minimumScore = 0.5) {
  if (!mask?.length || !mask[0]?.length) {
    return {
      value: null,
      confidence: 0,
      raw: '',
      variants: [],
    };
  }

  const recognized = recognizeNumericSequence(mask, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], minimumScore);
  const parsed = parseCountFromRecognized(recognized);

  return {
    value: parsed?.value || null,
    confidence: parsed?.confidence || 0,
    raw: parsed?.raw || recognized.map((item) => item.char).join(''),
    variants: recognized,
  };
}

function chooseBestCountCandidate(candidates) {
  const valid = candidates.filter((candidate) => Number.isInteger(candidate?.value) && candidate.value >= 0);
  if (valid.length === 0) {
    return candidates[0] || {
      value: null,
      confidence: 0,
      raw: '',
      variants: [],
    };
  }

  const scored = valid
    .map((candidate) => {
      const rawLength = String(candidate.raw || '').replace(/\D/g, '').length;
      const strategyBonus = candidate.strategy === 'anchor-ocr-labeled' ? 0.18 : 0;
      return {
        candidate,
        score: candidate.confidence + (Math.min(rawLength, 7) * 0.04) + strategyBonus,
      };
    })
    .sort((left, right) => right.score - left.score);

  return scored[0].candidate;
}

function isolateRightmostGlyphRun(mask) {
  const groups = findGlyphGroups(mask).filter((group) => (group.end - group.start + 1) >= 2);
  if (groups.length === 0) return null;

  const rightmost = [groups.at(-1)];
  for (let index = groups.length - 2; index >= 0; index -= 1) {
    const group = groups[index];
    const next = rightmost[0];
    if ((next.start - group.end) <= 18) {
      rightmost.unshift(group);
      continue;
    }
    break;
  }

  if (rightmost[0].start < Math.floor(mask[0].length * 0.35)) {
    return null;
  }

  const start = rightmost[0].start;
  const end = rightmost.at(-1).end;
  return cropMask(mask, {
    left: Math.max(0, start - 6),
    top: 0,
    width: Math.min(mask[0].length - Math.max(0, start - 6), (end - start + 1) + 12),
    height: mask.length,
  });
}

function cropTrailingMask(mask, fraction = 0.42) {
  const width = mask[0].length;
  const start = Math.max(0, Math.floor(width * (1 - fraction)));
  return cropMask(mask, {
    left: start,
    top: 0,
    width: width - start,
    height: mask.length,
  });
}

async function recognizeCountBlock({ sharp, Tesseract, imageBuffer, rect, fallbackRect, kind, pokemonName }) {
  const { data, info } = await getRawImage(sharp, imageBuffer);
  const fullMask = buildTextMaskForRect(data, info, rect);
  const valueMask = buildTextMaskForRect(data, info, fallbackRect || rect);
  const expandedRowRect = expandRect({
    left: Math.max(0, rect.left - Math.floor(rect.width * 0.30)),
    top: rect.top,
    width: Math.min(info.width - Math.max(0, rect.left - Math.floor(rect.width * 0.30)), Math.floor(rect.width * 1.30)),
    height: rect.height,
  }, info.width, info.height, 8, 4);
  const candidateMasks = [
    { name: 'value-isolated', mask: isolateRightmostGlyphRun(valueMask) },
    { name: 'value-full', mask: valueMask },
    { name: 'value-trailing-85', mask: cropTrailingMask(valueMask, 0.85) },
    { name: 'value-trailing-70', mask: cropTrailingMask(valueMask, 0.70) },
    { name: 'block-full', mask: fullMask },
    { name: 'block-trailing-75', mask: cropTrailingMask(fullMask, 0.75) },
    { name: 'block-trailing-60', mask: cropTrailingMask(fullMask, 0.60) },
    { name: 'block-trailing-55-isolated', mask: isolateRightmostGlyphRun(cropTrailingMask(fullMask, 0.55)) },
    { name: 'block-trailing-42-isolated', mask: isolateRightmostGlyphRun(cropTrailingMask(fullMask, 0.42)) },
  ].filter((candidate) => candidate.mask);
  const templateCandidates = candidateMasks.map((candidate) => ({
    crop: candidate.name,
    source: 'template-mask',
    strategy: 'anchor-template',
    variant: 'battle-template',
    ...recognizeCountFromMask(candidate.mask, 0.5),
  }));
  const ocrCandidate = await recognizeEncounterRowBlock({
    sharp,
    Tesseract,
    imageBuffer,
    rect: expandedRowRect,
    kind,
    pokemonName,
  });
  const best = chooseBestCountCandidate([
    ...templateCandidates,
    ocrCandidate,
  ]);

  return {
    rect,
    value: best.value,
    confidence: best.confidence,
    strategy: best.strategy || 'anchor-template',
    raw: best.raw,
    variant: best.variant || 'battle-template',
    variants: best.variants,
    debugCandidates: [
      ...templateCandidates.map((candidate) => ({
        source: candidate.source,
        crop: candidate.crop,
        strategy: candidate.strategy,
        variant: candidate.variant,
        value: candidate.value,
        confidence: candidate.confidence,
        raw: candidate.raw,
        glyphs: candidate.variants,
      })),
      ...(ocrCandidate.debugCandidates || []),
    ],
  };
}

async function detectAnchors(sharp, imageBuffer) {
  const { width, height } = await getImageMetadata(sharp, imageBuffer);
  const { data, info } = await getRawImage(sharp, imageBuffer);
  const footerTop = findFooterTop(data, info);
  const mask = buildFooterMask(data, info, footerTop);
  const rowGroups = findRowGroups(mask);
  const fallbackBlocks = buildFallbackBlocks(width, height, footerTop);

  if (rowGroups.length < 2) {
    return {
      footerTop,
      rowGroups,
      blocks: fallbackBlocks,
      usedFallback: true,
    };
  }

  const topBlocks = findColumnBlocks(mask, rowGroups[0]);
  const bottomBlocks = findColumnBlocks(mask, rowGroups[1]);

  if (topBlocks.length < 2 || bottomBlocks.length < 2) {
    return {
      footerTop,
      rowGroups,
      blocks: fallbackBlocks,
      usedFallback: true,
    };
  }

  return {
    footerTop,
    rowGroups,
    usedFallback: false,
    blocks: {
      ivs: anchorRectFromGroup(topBlocks[0], rowGroups[0], footerTop, width, height, 'left'),
      totalEncounters: anchorRectFromGroup(topBlocks[1], rowGroups[0], footerTop, width, height, 'right'),
      nature: anchorRectFromGroup(bottomBlocks[0], rowGroups[1], footerTop, width, height, 'left'),
      speciesEncounters: anchorRectFromGroup(bottomBlocks[1], rowGroups[1], footerTop, width, height, 'right'),
    },
  };
}

async function parseMobileStatsPanel({ imageBuffer, sharp, Tesseract, pokemonName }) {
  const anchors = await detectAnchors(sharp, imageBuffer);
  const { data, info } = await getRawImage(sharp, imageBuffer);

  if (!anchors.blocks) {
    return {
      hp: null,
      atk: null,
      def: null,
      spa: null,
      spd: null,
      spe: null,
      nature: null,
      totalEncounters: null,
      speciesEncounters: null,
      confidence: 0,
      meta: {
        pokemonName,
        anchors,
        recognizers: null,
      },
    };
  }

  const valueRects = deriveValueRects(anchors.blocks, data, info);

  const [ivs, nature, totalEncounters, speciesEncounters] = await Promise.all([
    recognizeIvBlock({ sharp, Tesseract, imageBuffer, rect: valueRects.ivs }),
    recognizeNatureBlock({ sharp, Tesseract, imageBuffer, rect: valueRects.nature }),
    recognizeCountBlock({
      sharp,
      Tesseract,
      imageBuffer,
      rect: valueRects.totalEncountersBlock,
      fallbackRect: valueRects.totalEncountersValue,
      kind: 'total',
      pokemonName,
    }),
    recognizeCountBlock({
      sharp,
      Tesseract,
      imageBuffer,
      rect: valueRects.speciesEncountersBlock,
      fallbackRect: valueRects.speciesEncountersValue,
      kind: 'species',
      pokemonName,
    }),
  ]);

  const ivValues = Array.isArray(ivs.value) ? ivs.value : [];
  const confidence = Math.max(
    ivs.confidence,
    nature.confidence,
    totalEncounters.confidence,
    speciesEncounters.confidence
  );

  return {
    hp: ivValues[0] ?? null,
    atk: ivValues[1] ?? null,
    def: ivValues[2] ?? null,
    spa: ivValues[3] ?? null,
    spd: ivValues[4] ?? null,
    spe: ivValues[5] ?? null,
    nature: nature.value,
    totalEncounters: totalEncounters.value,
    speciesEncounters: speciesEncounters.value,
    confidence,
    meta: {
      pokemonName,
      anchors,
      valueRects,
      recognizers: {
        ivs,
        nature,
        totalEncounters,
        speciesEncounters,
      },
    },
  };
}

module.exports = {
  parseMobileStatsPanel,
  _test: {
    buildEncounterLabelPatterns,
    chooseBestCountCandidate,
    NUMERIC_TEMPLATES,
    parseEncounterCountCandidate,
    recognizeCountFromMask,
  },
};
