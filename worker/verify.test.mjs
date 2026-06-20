import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import { resetGoogleJwksCache, setGoogleJwksFetchForTesting, verifyGoogleIdToken } from './verify.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
const KID = 'test-key';
const ENV = { GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com' };

function base64Url(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
}

function makeToken({ header = { alg: 'RS256', kid: KID }, claims = {}, signingKey = privateKey } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = base64Url(header);
  const encodedClaims = base64Url({
    iss: 'https://accounts.google.com',
    aud: ENV.GOOGLE_CLIENT_ID,
    sub: 'google-subject',
    exp: now + 300,
    iat: now - 10,
    ...claims
  });
  const input = `${encodedHeader}.${encodedClaims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(input);
  signer.end();
  return `${input}.${signer.sign(signingKey).toString('base64url')}`;
}

function installJwks() {
  resetGoogleJwksCache();
  setGoogleJwksFetchForTesting(async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] }), {
    headers: { 'Cache-Control': 'public, max-age=300' }
  }));
}

test('verifies a Google ID token and returns its identity claims', async () => {
  installJwks();
  const identity = await verifyGoogleIdToken(makeToken(), ENV);
  assert.equal(identity.sub, 'google-subject');
  assert.equal(identity.email, undefined);
  assert.equal(identity.email_verified, undefined);
});

test('rejects a token with the wrong audience', async () => {
  installJwks();
  await assert.rejects(verifyGoogleIdToken(makeToken({ claims: { aud: 'other-client' } }), ENV));
});

test('rejects an expired token', async () => {
  installJwks();
  await assert.rejects(verifyGoogleIdToken(makeToken({ claims: { exp: Math.floor(Date.now() / 1000) - 61 } }), ENV));
});

test('rejects a token with an invalid signature', async () => {
  installJwks();
  const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  await assert.rejects(verifyGoogleIdToken(makeToken({ signingKey: otherKey }), ENV));
});

test('rejects a token using a non-RS256 algorithm', async () => {
  installJwks();
  await assert.rejects(verifyGoogleIdToken(makeToken({ header: { alg: 'HS256', kid: KID } }), ENV));
});
