import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Give /app/, /dev/, and /ryan/ distinct PWA identities so all three can be
 * installed on one phone. Nested scopes under the same prefix block a second
 * install — deploy keeps them as siblings. */
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
        .replace(/icon\.png/g, icon)
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
    },
  }
}

type Flavor = 'app' | 'dev' | 'ryan'

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
    icon: 'icon.png',
    theme: '#64d66f',
  },
  dev: {
    title: 'Overdrive Dev',
    name: 'Overdrive Dev',
    short_name: 'OD Dev',
    description: 'Development build of the Overdrive setlist companion.',
    icon: 'icon-dev.png',
    theme: '#ef4d4d',
  },
  ryan: {
    title: 'Overdrive Ryan',
    name: 'Overdrive Ryan',
    short_name: 'OD Ryan',
    description: 'Personal App offshoot with Ryan-specific sheet tweaks.',
    icon: 'icon-ryan.png',
    theme: '#ff2a6d',
  },
}

function deployFlavor(base: string): Flavor {
  if (base.includes('/dev/')) return 'dev'
  if (base.includes('/ryan/')) return 'ryan'
  return 'app'
}

export default defineConfig({
  plugins: [react(), deployIdentity()],
  server: {
    port: 43117,
    strictPort: true,
  },
})
