// Self-contained URL-safe base64 encoding
// Uses standard base64 with URL-safe characters

export function compressURL(url: string): string {
  try {
    const encoded = btoa(unescape(encodeURIComponent(url)));
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

export function decompressURL(compressed: string): string {
  try {
    let base64 = compressed.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    return '';
  }
}
