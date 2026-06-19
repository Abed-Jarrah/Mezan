export function applyLease(state, { operation, deviceId, now, leaseMs }) {
  const current = state && typeof state.deviceId === 'string' && Number.isFinite(state.expiresAt) ? state : null;
  const expiresAt = now + leaseMs;

  if (operation === 'release') {
    return { nextState: current?.deviceId === deviceId ? null : current, result: { ok: true } };
  }

  // A different device blocks us when its lease is still live. For 'renew' it blocks even when
  // expired — only 'acquire' may take over an expired lease held by another device.
  if (current && current.deviceId !== deviceId) {
    const live = now < current.expiresAt;
    if (live || operation === 'renew') {
      return { nextState: current, result: { ok: false, heldByOther: true, expiresAt: current.expiresAt } };
    }
  }

  return { nextState: { deviceId, expiresAt }, result: { ok: true, expiresAt } };
}

export class SyncLease {
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
    if (!['acquire', 'renew', 'release'].includes(payload?.operation)) {
      return Response.json({ error: 'invalid_operation' }, { status: 400 });
    }

    const result = await this.ctx.storage.transaction(async storage => {
      const outcome = applyLease(await storage.get('leaseState'), payload);
      if (outcome.nextState) await storage.put('leaseState', outcome.nextState);
      else await storage.delete('leaseState');
      return outcome.result;
    });
    return Response.json(result);
  }
}
