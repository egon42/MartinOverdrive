import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Give /app/ and /dev/ distinct PWA identities so both can be installed on
 * one phone. Nested scopes under the same prefix block a second install —
 * deploy keeps them as siblings. */
function deployIdentity(): Plugin {
  let base = '/'
  return {
    name: 'overdrive-deploy-identity',
    configResolved(config) {
      base = config.base.endsWith('/') ? config.base : `${config.base}/`
    },
    transformIndexHtml(html) {
      const flavor = deployFlavor(base)
      const { title, icon, theme } = FLAVORS[flavor]
      return html
        .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
        .replace(
          /<meta name="apple-mobile-web-app-title" content="[^"]*"\s*\/?>/,
          `<meta name="apple-mobile-web-app-title" content="${title}" />`,
        )
        .replace(/<meta name="theme-color" content="[^"]*"\s*\/?>/, `<meta name="theme-color" content="${theme}" />`)
        // BASE_URL is already expanded by the time this runs.
        .replace(/icon-v2\.png/g, icon)
    },
    writeBundle(options) {
      const flavor = deployFlavor(base)
      const { name, short_name, description, icon, theme } = FLAVORS[flavor]
      const outDir = options.dir
      if (!outDir) return
      const manifest = {
        id: base,
        name,
        short_name,
        description,
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#000000',
        theme_color: theme,
        icons: [{
          src: icon,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        }],
      }
      writeFileSync(join(outDir, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`)
      // Stamp sw.js so every deploy byte-diffs the worker (see BUILD_ID in public/sw.js).
      const swPath = join(outDir, 'sw.js')
      try {
        const stamped = readFileSync(swPath, 'utf8').replace(
          "const BUILD_ID = 'dev'",
          `const BUILD_ID = '${Date.now().toString(36)}'`,
        )
        writeFileSync(swPath, stamped)
      } catch {
        // sw.js missing (e.g. unexpected outDir) — leave the build alone
      }
    },
  }
}

type Flavor = 'app' | 'dev'

const FLAVORS: Record<Flavor, {
  title: string
  name: string
  short_name: string
  description: string
  icon: string
  theme: string
}> = {
  app: {
    title: 'Overdrive',
    name: 'Overdrive Setlist Companion',
    short_name: 'Overdrive',
    description: 'Local-first guitar practice and show-night setlist.',
    icon: 'icon-v2.png',
    theme: '#64d66f',
  },
  dev: {
    title: 'Overdrive Dev',
    name: 'Overdrive Dev',
    short_name: 'OD Dev',
    description: 'Development build of the Overdrive setlist companion.',
    icon: 'icon-dev-v2.png',
    theme: '#ef4d4d',
  },
}

function deployFlavor(base: string): Flavor {
  if (base.includes('/dev/')) return 'dev'
  return 'app'
}

export default defineConfig({
  plugins: [react(), deployIdentity()],
  server: {
    port: 43117,
    strictPort: true,
  },
})
