const MezanSync = (() => {
  const SCHEMA_VERSION = 1;

  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

  const stableJson = value => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('Invalid sync payload');
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (isObject(value)) {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
    }
    throw new Error('Invalid sync payload');
  };

  const validRevision = value => Number.isInteger(value) && value >= 0;

  const validUpdatedAt = value =>
    typeof value === 'string' && value && !Number.isNaN(Date.parse(value));

  function checksum(payloadObject) {
    if (!isObject(payloadObject)) throw new Error('Invalid sync payload');
    const serialized = stableJson(payloadObject);
    let hash = 0x811c9dc5;
    for (let index = 0; index < serialized.length; index += 1) {
      hash ^= serialized.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    // FNV-1a detects accidental corruption; it is not a security mechanism.
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function validateEnvelope(envelope) {
    if (!isObject(envelope) ||
      !Number.isInteger(envelope.schemaVersion) ||
      !validRevision(envelope.rev) ||
      typeof envelope.deviceId !== 'string' || !envelope.deviceId.trim() ||
      !validUpdatedAt(envelope.updatedAt) ||
      typeof envelope.checksum !== 'string' || !envelope.checksum ||
      !isObject(envelope.payload)) {
      throw new Error('Invalid sync envelope');
    }
  }

  function wrap(payloadObject, options) {
    if (!isObject(options) || !validRevision(options.rev) ||
      typeof options.deviceId !== 'string' || !options.deviceId.trim()) {
      throw new Error('Invalid sync wrap options');
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      rev: options.rev,
      deviceId: options.deviceId,
      updatedAt: new Date().toISOString(),
      checksum: checksum(payloadObject),
      payload: payloadObject
    };
  }

  function migrate(envelope) {
    validateEnvelope(envelope);
    if (envelope.schemaVersion > SCHEMA_VERSION) throw new Error('Unsupported sync schema version');
    if (envelope.schemaVersion < 1) throw new Error('Unknown sync schema version');
    let migrated = envelope;
    while (migrated.schemaVersion < SCHEMA_VERSION) {
      switch (migrated.schemaVersion) {
        // Add one migration case per released schema, for example: case 1: migrated = migrateV1ToV2(migrated); break;
        default:
          throw new Error('Unknown sync schema version');
      }
    }
    return migrated;
  }

  function unwrap(envelope) {
    validateEnvelope(envelope);
    if (envelope.schemaVersion > SCHEMA_VERSION) throw new Error('Unsupported sync schema version');
    if (envelope.schemaVersion < 1) throw new Error('Unknown sync schema version');
    if (checksum(envelope.payload) !== envelope.checksum) throw new Error('checksum_mismatch');
    const migrated = envelope.schemaVersion < SCHEMA_VERSION ? migrate(envelope) : envelope;
    return {
      payload: migrated.payload,
      meta: {
        schemaVersion: migrated.schemaVersion,
        rev: migrated.rev,
        deviceId: migrated.deviceId,
        updatedAt: migrated.updatedAt
      }
    };
  }

  function nextRev(rev) {
    if (!validRevision(rev)) throw new Error('Invalid sync revision');
    return rev + 1;
  }

  function detectConflict(local, remote) {
    if (!isObject(local) || typeof local.hasLocalEdits !== 'boolean' || !isObject(remote)) {
      throw new Error('Invalid sync conflict state');
    }
    const baseRevisionId = local.baseRevisionId ?? null;
    const revisionId = remote.revisionId ?? null;
    if ((baseRevisionId !== null && typeof baseRevisionId !== 'string') ||
      (revisionId !== null && typeof revisionId !== 'string')) {
      throw new Error('Invalid sync conflict state');
    }
    if (revisionId === baseRevisionId) return 'fresh';
    // Drive can still last-write-win. The Durable Object session lease serializes writers;
    // this detects a rare lease-handoff race so the app can surface it instead of overwriting.
    return local.hasLocalEdits ? 'conflict' : 'remote_ahead';
  }

  return { SCHEMA_VERSION, checksum, wrap, unwrap, migrate, nextRev, detectConflict };
})();
// Expose on the global so other scripts can feature-detect via globalThis.MezanSync
// (a top-level `const` does not become a property of globalThis in a classic script).
globalThis.MezanSync = MezanSync;
