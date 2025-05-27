import { fetchShinyShowcase } from '../utils/forumParser.js';
import * as fs from 'fs/promises';
import * as path from 'path';

(async () => {
    const showcase = await fetchShinyShowcase();
    const dataPath = path.resolve('src/data/showcase.json');
    await fs.writeFile(dataPath, JSON.stringify(showcase, null, 2), 'utf-8');
    console.log('Showcase data written to /data/showcase.json');
})();