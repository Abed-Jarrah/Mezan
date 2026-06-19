const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const CLOCK_SKEW_SECONDS = 60;

let cachedJwks = null;
let jwksExpiresAt = 0;
let jwksFetch = fetch;

function tokenError() {
  return new Error('Google ID token verification failed');
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parseJsonPart(value) {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
  } catch {
    throw tokenError();
  }
}

function cacheLifetime(response) {
  const match = response.headers.get('Cache-Control')?.match(/(?:^|,)\s*max-age=(\d+)/i);
  return match ? Number(match[1]) * 1000 : 0;
}

async function getJwks(forceRefresh = false) {
  if (!forceRefresh && cachedJwks && Date.now() < jwksExpiresAt) {
    return cachedJwks;
  }

  let response;
  try {
    response = await jwksFetch(GOOGLE_JWKS_URL);
  } catch {
    throw tokenError();
  }
  if (!response.ok) throw tokenError();

  let body;
  try {
    body = await response.json();
  } catch {
    throw tokenError();
  }
  if (!Array.isArray(body.keys)) throw tokenError();

  cachedJwks = body.keys;
  jwksExpiresAt = Date.now() + cacheLifetime(response);
  return cachedJwks;
}

async function getSigningKey(kid) {
  let keys = await getJwks();
  let key = keys.find((candidate) => candidate.kid === kid);
  if (!key) {
    keys = await getJwks(true);
    key = keys.find((candidate) => candidate.kid === kid);
  }
  if (!key) throw tokenError();
  return key;
}

export async function verifyGoogleIdToken(idToken, env) {
  if (typeof idToken !== 'string' || !env?.GOOGLE_CLIENT_ID) throw tokenError();

  const parts = idToken.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) throw tokenError();

  const header = parseJsonPart(parts[0]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) throw tokenError();
  const claims = parseJsonPart(parts[1]);

  const jwk = await getSigningKey(header.kid);
  let publicKey;
  try {
    publicKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) throw tokenError();
  } catch (error) {
    if (error.message === 'Google ID token verification failed') throw error;
    throw tokenError();
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    (claims.iss !== 'accounts.google.com' && claims.iss !== 'https://accounts.google.com') ||
    claims.aud !== env.GOOGLE_CLIENT_ID ||
    typeof claims.sub !== 'string' || !claims.sub ||
    typeof claims.exp !== 'number' || claims.exp <= now - CLOCK_SKEW_SECONDS ||
    (claims.iat !== undefined && (typeof claims.iat !== 'number' || claims.iat > now + CLOCK_SKEW_SECONDS || claims.iat > claims.exp)) ||
    (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || claims.nbf > now + CLOCK_SKEW_SECONDS))
  ) {
    throw tokenError();
  }

  return { sub: claims.sub, email: claims.email, email_verified: claims.email_verified };
}

export function setGoogleJwksFetchForTesting(fetchImplementation) {
  jwksFetch = fetchImplementation;
}

export function resetGoogleJwksCache() {
  cachedJwks = null;
  jwksExpiresAt = 0;
}
