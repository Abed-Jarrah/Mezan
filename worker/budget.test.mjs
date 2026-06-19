import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseBudget, reserveBudget } from './budget.mjs';

const limits = { dailyBudget: 100, perUserBudget: 40 };
const emptyState = { utcDay: '2026-06-19', spentNeurons: 0, perUser: {}, killSwitch: false };

test('reserve succeeds when global and user budgets can cover the cost', () => {
  const { state, result } = reserveBudget(emptyState, { sub: 'alice', cost: 25, utcDay: '2026-06-19' }, limits);

  assert.deepEqual(result, { ok: true });
  assert.equal(state.spentNeurons, 25);
  assert.equal(state.perUser.alice, 25);
});

test('reserve fails closed when the global remaining budget is too small without changing state', () => {
  const prior = { ...emptyState, spentNeurons: 90, perUser: { alice: 90 } };
  const { state, result } = reserveBudget(prior, { sub: 'bob', cost: 11, utcDay: '2026-06-19' }, limits);

  assert.deepEqual(result, { ok: false, reason: 'global_exhausted' });
  assert.deepEqual(state, prior);
});

test('reserve fails when the verified user has exhausted their fairness budget', () => {
  const prior = { ...emptyState, spentNeurons: 35, perUser: { alice: 35 } };
  const { state, result } = reserveBudget(prior, { sub: 'alice', cost: 6, utcDay: '2026-06-19' }, limits);

  assert.deepEqual(result, { ok: false, reason: 'user_exhausted' });
  assert.deepEqual(state, prior);
});

test('reserve rolls over a prior UTC day before charging the new reservation', () => {
  const prior = { utcDay: '2026-06-18', spentNeurons: 95, perUser: { alice: 40, bob: 55 }, killSwitch: false };
  const { state, result } = reserveBudget(prior, { sub: 'carol', cost: 10, utcDay: '2026-06-19' }, limits);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(state, {
    utcDay: '2026-06-19',
    spentNeurons: 10,
    perUser: { carol: 10 },
    killSwitch: false
  });
});

test('release refunds a reservation and floors both counters at zero', () => {
  const prior = { ...emptyState, spentNeurons: 20, perUser: { alice: 12, bob: 8 } };
  const state = releaseBudget(prior, { sub: 'alice', cost: 50, utcDay: '2026-06-19' });

  assert.equal(state.spentNeurons, 0);
  assert.equal(state.perUser.alice, 0);
  assert.equal(state.perUser.bob, 8);
});

test('reserve is blocked by the persistent kill switch', () => {
  const prior = { ...emptyState, killSwitch: true };
  const { state, result } = reserveBudget(prior, { sub: 'alice', cost: 10, utcDay: '2026-06-19' }, limits);

  assert.deepEqual(result, { ok: false, reason: 'killed' });
  assert.deepEqual(state, prior);
});
