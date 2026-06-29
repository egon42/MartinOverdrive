export const baseUrl = import.meta.env.BASE_URL

export function assetUrl(path: string) {
  const normalized = path.replace(/^\//, '')
  return `${baseUrl}${normalized}`
}
