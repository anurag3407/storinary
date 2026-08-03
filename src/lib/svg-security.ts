/**
 * SVG security helpers.
 *
 * SVGs are valid image uploads, but a hostile SVG can carry inline scripts
 * that execute with the app's origin when served inline. We reject such
 * files at upload time, and serve any raw SVG with hardening headers so
 * even a legacy/edge-case SVG cannot run scripts.
 */

const UNSAFE_PATTERNS: RegExp[] = [
  /<script/i,
  /<foreignobject/i,
  /<iframe/i,
  /<embed/i,
  /<object/i,
  /<form/i,
  /<link/i,
  /<meta/i,
  /\bon[a-z]+\s*=/i, // event handlers: onclick, onload, onerror, ...
  /javascript\s*:/i,
  /data\s*:\s*text\/html/i,
  /@import/i,
  /url\s*\(\s*['"]?\s*javascript/i,
];

/**
 * Reject SVGs containing scripts, event handlers, or other active content.
 * Returns true when the SVG looks safe to store.
 */
export function isSafeSvg(buffer: Buffer | Uint8Array): boolean {
  const text = Buffer.from(buffer).toString('utf8').toLowerCase();
  return !UNSAFE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Headers applied when serving a raw (untransformed) SVG. `attachment`
 * prevents inline rendering; the sandbox CSP blocks script execution.
 */
export function svgSafeResponseHeaders(): Record<string, string> {
  return {
    'Content-Disposition': 'attachment; filename="image.svg"',
    'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'",
    'X-Content-Type-Options': 'nosniff',
  };
}
