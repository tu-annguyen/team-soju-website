import { fetchShinyShowcase } from '../utils/forumParser.js';
import fs from 'fs/promises';
import path from 'path';

const showcase = await fetchShinyShowcase();
const dataPath = path.resolve('src/data/showcase.json');
await fs.writeFile(dataPath, JSON.stringify(showcase, null, 2), 'utf-8');
console.log('Showcase data written to /data/showcase.json');