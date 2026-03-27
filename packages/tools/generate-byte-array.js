#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function readTableDirectory(buffer) {
  const numTables = buffer.readUInt16BE(4);
  const tables = new Map();

  for (let index = 0; index < numTables; index += 1) {
    const offset = 12 + (index * 16);
    const tag = buffer.toString('ascii', offset, offset + 4);
    tables.set(tag, {
      offset: buffer.readUInt32BE(offset + 8),
      length: buffer.readUInt32BE(offset + 12),
    });
  }

  return tables;
}

function getRequiredTable(tables, tag) {
  const table = tables.get(tag);

  if (!table) {
    throw new Error(`Missing required TrueType table: ${tag}`);
  }

  return table;
}

function getGlyphOffsets(buffer, tables) {
  const head = getRequiredTable(tables, 'head');
  const loca = getRequiredTable(tables, 'loca');
  const maxp = getRequiredTable(tables, 'maxp');
  const indexToLocFormat = buffer.readInt16BE(head.offset + 50);
  const numGlyphs = buffer.readUInt16BE(maxp.offset + 4);
  const offsets = [];

  for (let index = 0; index <= numGlyphs; index += 1) {
    const value = indexToLocFormat === 0
      ? buffer.readUInt16BE(loca.offset + (index * 2)) * 2
      : buffer.readUInt32BE(loca.offset + (index * 4));
    offsets.push(value);
  }

  return offsets;
}

function parseFormat4Cmap(buffer, subtableOffset) {
  const segCount = buffer.readUInt16BE(subtableOffset + 6) / 2;
  const endCodeOffset = subtableOffset + 14;
  const startCodeOffset = endCodeOffset + (segCount * 2) + 2;
  const idDeltaOffset = startCodeOffset + (segCount * 2);
  const idRangeOffsetOffset = idDeltaOffset + (segCount * 2);
  const mappings = new Map();

  for (let segmentIndex = 0; segmentIndex < segCount; segmentIndex += 1) {
    const startCode = buffer.readUInt16BE(startCodeOffset + (segmentIndex * 2));
    const endCode = buffer.readUInt16BE(endCodeOffset + (segmentIndex * 2));
    const idDelta = buffer.readInt16BE(idDeltaOffset + (segmentIndex * 2));
    const idRangeOffset = buffer.readUInt16BE(idRangeOffsetOffset + (segmentIndex * 2));

    if (startCode === 0xffff && endCode === 0xffff) {
      continue;
    }

    for (let codePoint = startCode; codePoint <= endCode; codePoint += 1) {
      let glyphIndex = 0;

      if (idRangeOffset === 0) {
        glyphIndex = (codePoint + idDelta) & 0xffff;
      } else {
        const glyphIndexAddress = idRangeOffsetOffset
          + (segmentIndex * 2)
          + idRangeOffset
          + ((codePoint - startCode) * 2);

        glyphIndex = buffer.readUInt16BE(glyphIndexAddress);

        if (glyphIndex !== 0) {
          glyphIndex = (glyphIndex + idDelta) & 0xffff;
        }
      }

      if (glyphIndex !== 0) {
        mappings.set(codePoint, glyphIndex);
      }
    }
  }

  return mappings;
}

function parseCharacterGlyphMap(buffer) {
  const tables = readTableDirectory(buffer);
  const cmap = getRequiredTable(tables, 'cmap');
  const glyphOffsets = getGlyphOffsets(buffer, tables);
  const glyf = getRequiredTable(tables, 'glyf');
  const numSubtables = buffer.readUInt16BE(cmap.offset + 2);
  let mappings = null;

  for (let index = 0; index < numSubtables; index += 1) {
    const recordOffset = cmap.offset + 4 + (index * 8);
    const platformId = buffer.readUInt16BE(recordOffset);
    const encodingId = buffer.readUInt16BE(recordOffset + 2);
    const subtableOffset = cmap.offset + buffer.readUInt32BE(recordOffset + 4);
    const format = buffer.readUInt16BE(subtableOffset);
    const isUnicode = platformId === 0 || (platformId === 3 && encodingId === 1);

    if (isUnicode && format === 4) {
      mappings = parseFormat4Cmap(buffer, subtableOffset);
      break;
    }
  }

  if (!mappings) {
    throw new Error('Unable to find a supported Unicode cmap subtable in the TTF.');
  }

  const entries = Array.from(mappings.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([codePoint, glyphIndex]) => {
      const glyphStart = glyphOffsets[glyphIndex];
      const glyphEnd = glyphOffsets[glyphIndex + 1];
      const glyphBytes = buffer.subarray(glyf.offset + glyphStart, glyf.offset + glyphEnd);

      return {
        char: String.fromCodePoint(codePoint),
        codePoint,
        glyphIndex,
        bytes: Array.from(glyphBytes),
      };
    });

  return entries;
}

function toSafeIdentifier(value) {
  return String(value)
    .replace(/[^A-Za-z0-9_$]+/g, '_')
    .replace(/^([^A-Za-z_$])/, '_$1');
}

function toHexLiteral(byte) {
  return `0x${byte.toString(16).padStart(2, '0')}`;
}

function buildByteArraySource(buffer, variableName, bytesPerLine = 12) {
  const lines = [];

  for (let index = 0; index < buffer.length; index += bytesPerLine) {
    const chunk = buffer.subarray(index, index + bytesPerLine);
    const isLastChunk = index + bytesPerLine >= buffer.length;
    const suffix = isLastChunk ? '' : ',';
    lines.push(`  ${Array.from(chunk, toHexLiteral).join(', ')}${suffix}`);
  }

  return [
    `const ${variableName} = [`,
    ...lines,
    '];',
    '',
    `module.exports = ${variableName};`,
    '',
  ].join('\n');
}

function buildCharacterMapSource(entries, variableName, bytesPerLine = 12) {
  const lines = [`const ${variableName} = {`];

  entries.forEach((entry, entryIndex) => {
    const key = JSON.stringify(entry.char);
    lines.push(`  ${key}: [`);

    for (let index = 0; index < entry.bytes.length; index += bytesPerLine) {
      const chunk = entry.bytes.slice(index, index + bytesPerLine);
      const isLastChunk = index + bytesPerLine >= entry.bytes.length;
      const suffix = isLastChunk ? '' : ',';
      lines.push(`    ${chunk.map(toHexLiteral).join(', ')}${suffix}`);
    }

    const isLastEntry = entryIndex === entries.length - 1;
    lines.push(`  ]${isLastEntry ? '' : ','}`);
  });

  return [
    ...lines,
    '};',
    '',
    `module.exports = ${variableName};`,
    '',
  ].join('\n');
}

function createDefaultOutputPath(inputPath) {
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}_bytes.js`);
}

function generateByteArrayFile(inputPath, outputPath, variableName) {
  const buffer = fs.readFileSync(inputPath);
  const source = buildByteArraySource(buffer, variableName);
  fs.writeFileSync(outputPath, source, 'utf8');
  return { bufferLength: buffer.length, outputPath, variableName };
}

function parseArgs(argv) {
  const args = [...argv];
  let inputPath = '';
  let outputPath = '';
  let variableName = '';
  let printOnly = false;
  let byCharacter = false;

  while (args.length > 0) {
    const arg = args.shift();

    if (arg === '--name') {
      variableName = args.shift() || '';
      continue;
    }

    if (arg === '--stdout') {
      printOnly = true;
      continue;
    }

    if (arg === '--by-character') {
      byCharacter = true;
      continue;
    }

    if (!inputPath) {
      inputPath = arg;
      continue;
    }

    if (!outputPath) {
      outputPath = arg;
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (!inputPath) {
    throw new Error(
      'Usage: node tools/generate-byte-array.js <input-file> [output-file] [--name variableName] [--stdout]'
    );
  }

  const resolvedInputPath = path.resolve(inputPath);
  const finalOutputPath = printOnly ? '' : path.resolve(outputPath || createDefaultOutputPath(resolvedInputPath));
  const finalVariableName = toSafeIdentifier(
    variableName || `${path.parse(resolvedInputPath).name}Bytes`
  );

  return {
    inputPath: resolvedInputPath,
    outputPath: finalOutputPath,
    variableName: finalVariableName,
    printOnly,
    byCharacter,
  };
}

if (require.main === module) {
  try {
    const {
      inputPath,
      outputPath,
      variableName,
      printOnly,
      byCharacter,
    } = parseArgs(process.argv.slice(2));
    const buffer = fs.readFileSync(inputPath);
    const source = byCharacter
      ? buildCharacterMapSource(parseCharacterGlyphMap(buffer), variableName)
      : buildByteArraySource(buffer, variableName);

    if (printOnly) {
      process.stdout.write(source);
      process.exit(0);
    }

    fs.writeFileSync(outputPath, source, 'utf8');
    process.stdout.write(
      `Wrote ${buffer.length} bytes from ${inputPath} to ${outputPath} as ${variableName}\n`
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildByteArraySource,
  buildCharacterMapSource,
  createDefaultOutputPath,
  generateByteArrayFile,
  parseCharacterGlyphMap,
  parseArgs,
  toSafeIdentifier,
};
