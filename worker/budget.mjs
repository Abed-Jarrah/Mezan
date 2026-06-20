import { DAILY_NEURON_BUDGET, PER_USER_DAILY_NEURON_BUDGET } from './ai-config.mjs';

function utcDayNow() {
  return new Date().toISOString().slice(0, 10);
}

function cleanState(state, utcDay) {
  if (!state || state.utcDay !== utcDay) {
    return { utcDay, spentNeurons: 0, perUser: {}, killSwitch: Boolean(state?.killSwitch) };
  }
  return {
    utcDay,
    spentNeurons: Math.max(0, Number(state.spentNeurons) || 0),
    perUser: { ...(state.perUser || {}) },
    killSwitch: Boolean(state.killSwitch)
  };
}

function validCost(cost) {
  return Number.isSafeInteger(cost) && cost > 0;
}

export function reserveBudget(state, { sub, cost, utcDay = utcDayNow() }, { dailyBudget, perUserBudget }) {
  const next = cleanState(state, utcDay);
  if (next.killSwitch) return { state: state || next, result: { ok: false, reason: 'killed' } };
  if (typeof sub !== 'string' || !sub || !validCost(cost)) {
    return { state: state || next, result: { ok: false, reason: 'global_exhausted' } };
  }
  if (next.spentNeurons + cost > dailyBudget) {
    return { state: state || next, result: { ok: false, reason: 'global_exhausted' } };
  }
  const userSpent = Math.max(0, Number(next.perUser[sub]) || 0);
  if (userSpent + cost > perUserBudget) {
    return { state: state || next, result: { ok: false, reason: 'user_exhausted' } };
  }
  next.spentNeurons += cost;
  next.perUser[sub] = userSpent + cost;
  return { state: next, result: { ok: true } };
}

export function releaseBudget(state, { sub, cost, utcDay = utcDayNow() }) {
  const next = cleanState(state, utcDay);
  if (typeof sub !== 'string' || !sub || !validCost(cost)) return next;
  next.spentNeurons = Math.max(0, next.spentNeurons - cost);
  next.perUser[sub] = Math.max(0, (Number(next.perUser[sub]) || 0) - cost);
  return next;
}

export function reconcileBudget(state, { sub, reserved, actual, utcDay = utcDayNow() }) {
  if (!validCost(reserved) || !Number.isFinite(actual)) return cleanState(state, utcDay);
  const refund = Math.max(0, Math.min(reserved, reserved - Math.max(0, actual)));
  return refund ? releaseBudget(state, { sub, cost: refund, utcDay }) : cleanState(state, utcDay);
}

export class AiBudget {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    if (request.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    let payload;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ error: 'invalid_json' }, { status: 400 });
    }

    const operation = payload?.operation;
    if (!['reserve', 'release', 'reconcile'].includes(operation)) {
      return Response.json({ error: 'invalid_operation' }, { status: 400 });
    }

    const response = await this.ctx.storage.transaction(async (storage) => {
      const state = await storage.get('budgetState');
      if (operation === 'reserve') {
        const outcome = reserveBudget(state, payload, {
          dailyBudget: DAILY_NEURON_BUDGET,
          perUserBudget: PER_USER_DAILY_NEURON_BUDGET
        });
        if (outcome.result.ok) await storage.put('budgetState', outcome.state);
        return outcome.result;
      }

      const next = operation === 'release'
        ? releaseBudget(state, payload)
        : reconcileBudget(state, payload);
      await storage.put('budgetState', next);
      return { ok: true };
    });

    return Response.json(response);
  }
}
