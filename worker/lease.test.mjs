import assert from 'node:assert/strict';
import test from 'node:test';
import { applyLease } from './lease.mjs';

const params = { deviceId: 'device-a', now: 1_000, leaseMs: 300 };

test('acquire grants an empty, expired, or same-device lease', () => {
  for (const state of [null, { deviceId: 'device-b', expiresAt: 1_000 }, { deviceId: 'device-a', expiresAt: 1_100 }]) {
    const { nextState, result } = applyLease(state, { ...params, operation: 'acquire' });
    assert.deepEqual(result, { ok: true, expiresAt: 1_300 });
    assert.deepEqual(nextState, { deviceId: 'device-a', expiresAt: 1_300 });
  }
});

test('acquire rejects a different live lease holder', () => {
  const state = { deviceId: 'device-b', expiresAt: 1_301 };
  const outcome = applyLease(state, { ...params, operation: 'acquire' });
  assert.deepEqual(outcome.nextState, state);
  assert.deepEqual(outcome.result, { ok: false, heldByOther: true, expiresAt: 1_301 });
});

test('renew extends the holder lease and rejects another live holder', () => {
  assert.deepEqual(
    applyLease({ deviceId: 'device-a', expiresAt: 900 }, { ...params, operation: 'renew' }),
    { nextState: { deviceId: 'device-a', expiresAt: 1_300 }, result: { ok: true, expiresAt: 1_300 } }
  );
  assert.deepEqual(
    applyLease({ deviceId: 'device-b', expiresAt: 1_301 }, { ...params, operation: 'renew' }),
    { nextState: { deviceId: 'device-b', expiresAt: 1_301 }, result: { ok: false, heldByOther: true, expiresAt: 1_301 } }
  );
});

test('renew does not let a different device take over an expired lease', () => {
  const state = { deviceId: 'device-b', expiresAt: 900 };
  assert.deepEqual(
    applyLease(state, { ...params, operation: 'renew' }),
    { nextState: state, result: { ok: false, heldByOther: true, expiresAt: 900 } }
  );
});

test('acquire (unlike renew) takes over a different device expired lease', () => {
  assert.deepEqual(
    applyLease({ deviceId: 'device-b', expiresAt: 900 }, { ...params, operation: 'acquire' }),
    { nextState: { deviceId: 'device-a', expiresAt: 1_300 }, result: { ok: true, expiresAt: 1_300 } }
  );
});

test('release clears only the holder lease', () => {
  assert.deepEqual(
    applyLease({ deviceId: 'device-a', expiresAt: 1_301 }, { ...params, operation: 'release' }),
    { nextState: null, result: { ok: true } }
  );
  const state = { deviceId: 'device-b', expiresAt: 1_301 };
  assert.deepEqual(applyLease(state, { ...params, operation: 'release' }), { nextState: state, result: { ok: true } });
});
