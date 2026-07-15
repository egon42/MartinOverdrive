import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Give /app/ (prod) and /dev/ distinct PWA identities so both can be installed on one phone.
 * Nested scopes under the same prefix block a second install — deploy keeps them as siblings. */
function deployIdentity(): Plugin {
  let base = '/'
  return {
    name: 'overdrive-deploy-identity',
    configResolved(config) {
      base = config.base.endsWith('/') ? config.base : `${config.base}/`
    },
    transformIndexHtml(html) {
      const isDev = base.includes('/dev/')
      const title = isDev ? 'Overdrive Dev' : 'Overdrive'
      const icon = isDev ? 'icon-dev.svg' : 'icon.svg'
      const theme = isDev ? '#ef4d4d' : '#000000'
      return html
        .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
        .replace(
          /<meta name="apple-mobile-web-app-title" content="[^"]*"\s*\/?>/,
          `<meta name="apple-mobile-web-app-title" content="${title}" />`,
        )
        .replace(/<meta name="theme-color" content="[^"]*"\s*\/?>/, `<meta name="theme-color" content="${theme}" />`)
        // BASE_URL is already expanded by the time this runs.
        .replace(/icon\.svg/g, icon)
    },
    writeBundle(options) {
      const isDev = base.includes('/dev/')
      const outDir = options.dir
      if (!outDir) return
      const manifest = {
        id: base,
        name: isDev ? 'Overdrive Dev' : 'Overdrive Setlist Companion',
        short_name: isDev ? 'OD Dev' : 'Overdrive',
        description: isDev
          ? 'Development build of the Overdrive setlist companion.'
          : 'Local-first guitar practice and show-night setlist.',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#000000',
        theme_color: isDev ? '#ef4d4d' : '#64d66f',
        icons: [{
          src: isDev ? 'icon-dev.svg' : 'icon.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any maskable',
        }],
      }
      writeFileSync(join(outDir, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`)
    },
  }
}

export default defineConfig({
  plugins: [react(), deployIdentity()],
  server: {
    port: 43117,
    strictPort: true,
  },
})
