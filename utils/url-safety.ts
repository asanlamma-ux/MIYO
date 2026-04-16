const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
const SAFE_EMBEDDED_PREFIXES = ['about:blank', 'about:srcdoc'];

function isPrivateOrLocalHost(hostname: string): boolean {
  if (LOOPBACK_HOSTS.has(hostname) || hostname.endsWith('.local')) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
  if (/^169\.254\./.test(hostname)) return true;
  if (/^fc00:/i.test(hostname) || /^fd/i.test(hostname) || /^fe80:/i.test(hostname)) return true;
  return false;
}

export function isSafeEmbeddedUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  return SAFE_EMBEDDED_PREFIXES.some(prefix => trimmed.startsWith(prefix));
}

export function isSafeExternalUrl(rawUrl: string | null | undefined, options?: { allowHttp?: boolean }): boolean {
  if (!rawUrl) return false;

  try {
    const trimmed = rawUrl.trim();
    if (!trimmed || isSafeEmbeddedUrl(trimmed)) return false;

    const parsed = new URL(trimmed);
    const allowHttp = options?.allowHttp ?? true;
    const isHttps = parsed.protocol === 'https:';
    const isHttp = parsed.protocol === 'http:';

    if (!isHttps && !(allowHttp && isHttp)) {
      return false;
    }

    if (parsed.username || parsed.password) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || isPrivateOrLocalHost(hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
