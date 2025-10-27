import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const configDir = path.dirname(fileURLToPath(import.meta.url));
const serviceWorkerSource = path.join(configDir, 'src/service-worker.ts');
const serviceWorkerTarget = path.join(configDir, 'public/service-worker.js');

function emitServiceWorker() {
  if (!fs.existsSync(serviceWorkerSource)) {
    return;
  }
  const source = fs.readFileSync(serviceWorkerSource, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2019,
      module: ts.ModuleKind.ESNext,
      removeComments: false,
    },
    fileName: 'service-worker.ts',
  });
  fs.mkdirSync(path.dirname(serviceWorkerTarget), { recursive: true });
  fs.writeFileSync(serviceWorkerTarget, result.outputText, 'utf8');
}

emitServiceWorker();

if (process.env.NODE_ENV === 'development') {
  fs.watchFile(serviceWorkerSource, { interval: 1000 }, () => {
    try {
      emitServiceWorker();
    } catch (error) {
      console.warn('Failed to rebuild service worker', error);
    }
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // experimental: { typedRoutes: true }, // optional
};

export default nextConfig;
