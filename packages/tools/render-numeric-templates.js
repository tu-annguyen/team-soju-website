const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sharp = require('sharp');

const sourcePath = path.resolve(__dirname, '../apps/api-server/src/utils/mobileStatsParser.js');
const outputPath = path.resolve(__dirname, 'numeric-templates.png');

function loadTemplates() {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const match = source.match(/const NUMERIC_TEMPLATES = (\{[\s\S]*?\n\});/);

  if (!match) {
    throw new Error(`Unable to locate NUMERIC_TEMPLATES in ${sourcePath}`);
  }

  return vm.runInNewContext(`(${match[1]})`);
}

async function render() {
  const templates = loadTemplates();
  const order = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '/'];
  const cellSize = 24;
  const glyphHeight = Math.max(...Object.values(templates).map((rows) => rows.length));
  const glyphWidths = Object.fromEntries(order.map((char) => [char, templates[char]?.[0]?.length || 0]));
  const maxGlyphWidth = Math.max(...Object.values(glyphWidths));
  const glyphPixelHeight = glyphHeight * cellSize;
  const padding = 20;
  const gap = 28;
  const columns = 4;
  const rows = Math.ceil(order.length / columns);
  const glyphSlotWidth = maxGlyphWidth * cellSize;
  const canvasWidth = (padding * 2) + (columns * glyphSlotWidth) + ((columns - 1) * gap);
  const canvasHeight = (padding * 2) + (rows * glyphPixelHeight) + ((rows - 1) * gap);
  const channels = 4;
  const buffer = Buffer.alloc(canvasWidth * canvasHeight * channels, 255);

  const paintPixel = (x, y, color) => {
    const offset = ((y * canvasWidth) + x) * channels;
    buffer[offset] = color[0];
    buffer[offset + 1] = color[1];
    buffer[offset + 2] = color[2];
    buffer[offset + 3] = color[3];
  };

  const fillRect = (left, top, width, height, color) => {
    for (let y = top; y < top + height; y += 1) {
      for (let x = left; x < left + width; x += 1) {
        paintPixel(x, y, color);
      }
    }
  };

  for (let index = 0; index < order.length; index += 1) {
    const char = order[index];
    const template = templates[char];

    if (!template) continue;

    const col = index % columns;
    const row = Math.floor(index / columns);
    const originX = padding + (col * (glyphSlotWidth + gap));
    const originY = padding + (row * (glyphPixelHeight + gap));
    const glyphPixelWidth = template[0].length * cellSize;

    fillRect(originX, originY, glyphSlotWidth, glyphPixelHeight, [244, 244, 239, 255]);

    for (let y = 0; y < template.length; y += 1) {
      for (let x = 0; x < template[y].length; x += 1) {
        const on = template[y][x] === '1';
        const color = on ? [20, 20, 20, 255] : [244, 244, 239, 255];
        fillRect(
          originX + (x * cellSize),
          originY + (y * cellSize),
          cellSize,
          cellSize,
          color
        );
      }
    }
  }

  await sharp(buffer, {
    raw: {
      width: canvasWidth,
      height: canvasHeight,
      channels,
    },
  }).png().toFile(outputPath);

  console.log(outputPath);
}

render().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
