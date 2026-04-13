import { readFileSync } from 'fs';
import { defineConfig } from 'vitest/config';

function rawTextAssets() {
  return {
    name: 'raw-text-assets',
    enforce: 'pre' as const,
    load(id: string) {
      const cleanId = id.split('?')[0] ?? id;
      if (!/\.(md|html)$/.test(cleanId)) return null;
      // Test-only shim: Bun runtime imports these files as text via `with { type: 'text' }`,
      // so Vitest needs to mirror that behavior instead of treating them as asset URLs.
      const content = readFileSync(cleanId, 'utf8');
      return `export default ${JSON.stringify(content)};`;
    },
  };
}

export default defineConfig({
  plugins: [rawTextAssets()],
  test: {
    environment: 'node',
  },
});
