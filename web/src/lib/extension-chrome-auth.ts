/**
 * Chrome extension identity redirect URLs:
 * https://<extension-id>.chromiumapp.org/
 */
export function isAllowedChromeExtensionRedirect(redirectUri: string): boolean {
  try {
    const u = new URL(redirectUri);
    if (u.protocol !== "https:") return false;
    if (!/\.chromiumapp\.org$/i.test(u.hostname)) return false;
    // Path may be "/" or a suffix (e.g. callback path); host is Chrome-controlled.
    return true;
  } catch {
    return false;
  }
}
