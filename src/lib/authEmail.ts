const AUTH_EMAIL_DOMAIN = 'gmail.com'
const LEGACY_AUTH_EMAIL_DOMAIN = 'gogopar.app'

function nameToHex(name: string): string {
  return Array.from(name.trim())
    .map((char) => char.charCodeAt(0).toString(16).padStart(4, '0'))
    .join('')
}

export function nameToAuthEmail(name: string): string {
  return `gogopar.${nameToHex(name)}@${AUTH_EMAIL_DOMAIN}`
}

export function nameToLegacyAuthEmail(name: string): string {
  return `${nameToHex(name)}@${LEGACY_AUTH_EMAIL_DOMAIN}`
}

export function authEmailsForName(name: string): string[] {
  return [nameToAuthEmail(name), nameToLegacyAuthEmail(name)]
}
