const MezanUI = (() => {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  const pad = value => String(value).padStart(2, '0');

  function localDate(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function localMonth(date = new Date()) {
    return localDate(date).slice(0, 7);
  }

  return { escapeHtml, localDate, localMonth };
})();
