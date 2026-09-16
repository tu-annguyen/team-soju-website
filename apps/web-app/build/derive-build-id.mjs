import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

export const WEB_APP_BUILD_INPUTS = [
  'apps/web-app/build',
  'apps/web-app/public',
  'apps/web-app/src',
  'apps/web-app/astro.config.mjs',
  'apps/web-app/package.json',
  'apps/web-app/tailwind.config.mjs',
  'apps/web-app/tsconfig.json',
  'packages/utils/src',
  'packages/utils/build.mjs',
  'packages/utils/package.json',
  'packages/utils/pokemon-tiers.json',
];

const COMPATIBILITY_ENVIRONMENT_VARIABLE = 'WEB_APP_COMPATIBILITY_VERSION';

function compareNames(left, right) {
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
}

function addPathToHash(hash, repositoryDirectory, path) {
  const entries = readdirSync(path, { withFileTypes: true }).sort(compareNames);

  for (const entry of entries) {
    const entryPath = resolve(path, entry.name);

    if (entry.isDirectory()) {
      addPathToHash(hash, repositoryDirectory, entryPath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    hash.update(relative(repositoryDirectory, entryPath));
    hash.update('\0');
    hash.update(readFileSync(entryPath));
    hash.update('\0');
  }
}

export function deriveWebAppBuildId(repositoryDirectory, environment = process.env) {
  const hash = createHash('sha256');

  for (const input of WEB_APP_BUILD_INPUTS) {
    const inputPath = resolve(repositoryDirectory, input);
    const entry = readFileOrDirectory(inputPath);

    if (entry === 'directory') {
      addPathToHash(hash, repositoryDirectory, inputPath);
    } else {
      hash.update(input);
      hash.update('\0');
      hash.update(readFileSync(inputPath));
      hash.update('\0');
    }
  }

  const buildEnvironment = Object.entries(environment)
    .filter(([name]) => (
      name.startsWith('PUBLIC_') || name === COMPATIBILITY_ENVIRONMENT_VARIABLE
    ))
    .filter(([name]) => name !== 'PUBLIC_APP_BUILD_ID')
    .sort(([left], [right]) => left.localeCompare(right));

  for (const [name, value] of buildEnvironment) {
    hash.update(name);
    hash.update('=');
    hash.update(value || '');
    hash.update('\0');
  }

  return `web-${hash.digest('hex').slice(0, 24)}`;
}

function readFileOrDirectory(path) {
  try {
    readdirSync(path);
    return 'directory';
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOTDIR') {
      return 'file';
    }

    throw error;
  }
}
