export function renderDetailPanel(container, detail) {
  if (!detail) {
    container.innerHTML =
      '<p class="wv-detail-empty">Select a satellite, flight, or CCTV node on the map.</p>';
    return;
  }

  const fields = (detail.fields || [])
    .map(
      ([k, v]) =>
        `<div class="wv-detail-row"><span class="wv-detail-k">${k}</span><span class="wv-detail-v">${v}</span></div>`
    )
    .join('');

  let media = '';
  if (detail.type === 'cctv' && detail.feedUrl) {
    media = `<div class="wv-detail-feed-slot" id="detail-cctv-feed"></div>
      <span class="wv-detail-feed-cap">Near-live public snapshot · refreshes ~2s</span>`;
  } else if (detail.type === 'cctv' && detail.snapshotUrl) {
    media = `<div class="wv-detail-feed">
      <img src="${detail.snapshotUrl}" alt="CCTV snapshot" referrerpolicy="no-referrer" />
    </div>`;
  }
  if (detail.type === 'cctv' && detail.pageUrl) {
    media += `<a class="wv-detail-link" href="${detail.pageUrl}" target="_blank" rel="noopener">Open source page</a>`;
  }

  container.innerHTML = `
    <div class="wv-detail-head">
      <span class="wv-detail-type">${detail.typeLabel || detail.type}</span>
      <h3 class="wv-detail-title">${detail.title}</h3>
      ${detail.subtitle ? `<p class="wv-detail-sub">${detail.subtitle}</p>` : ''}
    </div>
    ${media}
    <div class="wv-detail-grid">${fields}</div>
    ${detail.notes ? `<p class="wv-detail-notes">${detail.notes}</p>` : ''}
  `;
}
