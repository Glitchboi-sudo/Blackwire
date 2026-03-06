// Shannon Entropy calculation for filtering false positives
export function calculateEntropy(str) {
  if (!str || str.length === 0) return 0;
  const freq = {};
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    freq[c] = (freq[c] || 0) + 1;
  }
  const len = str.length;
  let entropy = 0;
  for (const c in freq) {
    const p = freq[c] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// JWT Helper Functions
export function base64urlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  try {
    return atob(base64);
  } catch (e) {
    return '';
  }
}

export function base64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function decodeJWT(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return {
      header: JSON.parse(base64urlDecode(parts[0])),
      payload: JSON.parse(base64urlDecode(parts[1])),
      signature: parts[2]
    };
  } catch (e) {
    return null;
  }
}

export function encodeJWT(header, payload, signature) {
  try {
    const h = base64urlEncode(JSON.stringify(header));
    const p = base64urlEncode(JSON.stringify(payload));
    return h + '.' + p + '.' + (signature || '');
  } catch (e) {
    return '';
  }
}
