const MezanDrive = (() => {
  const FILE_NAME = 'mezan-vault.json';
  const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
  const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

  function buildListQuery() {
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      fields: 'files(id,name,headRevisionId)',
      q: `name='${FILE_NAME}'`
    });
    return params.toString();
  }

  function buildMultipartBody(metadata, contentString, boundary) {
    return `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${contentString}\r\n--${boundary}--`;
  }

  async function request(url, token, options) {
    const response = await fetch(url, Object.assign({}, options, {
      headers: Object.assign({}, options?.headers, { Authorization: `Bearer ${token}` })
    }));
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.text()).slice(0, 200); } catch {}
      throw new Error(`Drive ${response.status}: ${detail}`);
    }
    return response;
  }

  async function findFile(token) {
    const response = await request(`${DRIVE_API}?${buildListQuery()}`, token);
    const data = await response.json();
    const file = data.files?.[0];
    return file ? { id: file.id, headRevisionId: file.headRevisionId } : null;
  }

  async function readFile(token, id) {
    const fileId = encodeURIComponent(id);
    const [contentResponse, metadataResponse] = await Promise.all([
      request(`${DRIVE_API}/${fileId}?alt=media`, token),
      request(`${DRIVE_API}/${fileId}?fields=headRevisionId`, token)
    ]);
    return {
      content: JSON.parse(await contentResponse.text()),
      headRevisionId: (await metadataResponse.json()).headRevisionId
    };
  }

  async function createFile(token, contentString) {
    const boundary = `mezan-${crypto.randomUUID()}`;
    const metadata = { name: FILE_NAME, parents: ['appDataFolder'] };
    const response = await request(`${UPLOAD_API}?uploadType=multipart&fields=id,headRevisionId`, token, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: buildMultipartBody(metadata, contentString, boundary)
    });
    return response.json();
  }

  async function updateFile(token, id, contentString) {
    const response = await request(`${UPLOAD_API}/${encodeURIComponent(id)}?uploadType=media&fields=headRevisionId`, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: contentString
    });
    return response.json();
  }

  async function saveVault(token, contentString) {
    const existing = await findFile(token);
    if (existing) {
      const updated = await updateFile(token, existing.id, contentString);
      return { id: existing.id, headRevisionId: updated.headRevisionId };
    }
    return createFile(token, contentString);
  }

  return { FILE_NAME, buildListQuery, buildMultipartBody, findFile, readFile, createFile, updateFile, saveVault };
})();
// Expose on the global so other scripts can feature-detect via globalThis.MezanDrive
// (a top-level `const` does not become a property of globalThis in a classic script).
globalThis.MezanDrive = MezanDrive;
