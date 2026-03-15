/**
 * htmx-r WhatsApp Manager Extension
 * Account slot management UI for the flow-hq wa-manager service.
 *
 * Usage:
 *   <script src="htmx-r-whatsapp-manager.js"></script>
 *   <div id="wa-panel"></div>
 *   <script>
 *     HtmxRWhatsappManager.init('wa-panel', { endpoint: 'http://localhost:8131' })
 *   </script>
 *
 * API endpoints consumed:
 *   GET  {endpoint}/accounts                  → [{slot, status, port, label}]
 *   GET  {endpoint}/accounts/pair             → SSE: slot, qr, paired, timeout, error
 *   POST {endpoint}/accounts/{slot}/activate
 *   POST {endpoint}/accounts/{slot}/deactivate
 *   DELETE {endpoint}/accounts/{slot}
 *
 * Status values from API:
 *   "running"  → green dot, Pause button
 *   "stopped"  → amber dot, Resume button
 *   "unpaired" → gray dot, no activate/deactivate
 *
 * All state is managed via closure — no globals polluted beyond window.HtmxRWhatsappManager.
 */

const HtmxRWhatsappManager = (() => {

  // ─── Theme constants ──────────────────────────────────────────────────────
  const COLOR = {
    bg:        '#0a0a0f',
    bgCard:    '#0f0f1a',
    bgModal:   'rgba(0,0,0,0.75)',
    border:    '#1a1a2e',
    borderFocus: '#3b3b5c',
    connected: '#22c55e',
    stopped:   '#f59e0b',
    unpaired:  '#6b7280',
    text:      '#e2e8f0',
    textMuted: '#94a3b8',
    textDim:   '#64748b',
    accent:    '#6366f1',
    accentHov: '#4f52d6',
    danger:    '#dc2626',
    dangerHov: '#b91c1c',
    success:   '#16a34a',
  };

  const CSS_ID = 'htmx-r-wa-manager-styles';

  // ─── CSS injection (once per page) ───────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(CSS_ID)) return;

    const style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = `
      .wa-panel {
        font-family: 'Courier New', Courier, monospace;
        background: ${COLOR.bg};
        color: ${COLOR.text};
        padding: 24px;
        border-radius: 12px;
        border: 1px solid ${COLOR.border};
        min-width: 320px;
      }

      .wa-panel__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid ${COLOR.border};
      }

      .wa-panel__title {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: ${COLOR.textMuted};
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .wa-panel__title-dot {
        width: 8px;
        height: 8px;
        background: ${COLOR.connected};
        border-radius: 50%;
        box-shadow: 0 0 6px ${COLOR.connected};
        flex-shrink: 0;
      }

      .wa-btn {
        font-family: 'Courier New', Courier, monospace;
        font-size: 12px;
        letter-spacing: 0.04em;
        border: 1px solid transparent;
        border-radius: 6px;
        padding: 6px 14px;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s, opacity 0.15s;
        white-space: nowrap;
      }

      .wa-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .wa-btn--primary {
        background: ${COLOR.accent};
        border-color: ${COLOR.accent};
        color: #fff;
      }

      .wa-btn--primary:hover:not(:disabled) {
        background: ${COLOR.accentHov};
        border-color: ${COLOR.accentHov};
      }

      .wa-btn--ghost {
        background: transparent;
        border-color: ${COLOR.border};
        color: ${COLOR.textMuted};
      }

      .wa-btn--ghost:hover:not(:disabled) {
        border-color: ${COLOR.borderFocus};
        color: ${COLOR.text};
      }

      .wa-btn--success {
        background: transparent;
        border-color: ${COLOR.connected};
        color: ${COLOR.connected};
      }

      .wa-btn--success:hover:not(:disabled) {
        background: ${COLOR.connected}18;
      }

      .wa-btn--warning {
        background: transparent;
        border-color: ${COLOR.stopped};
        color: ${COLOR.stopped};
      }

      .wa-btn--warning:hover:not(:disabled) {
        background: ${COLOR.stopped}18;
      }

      .wa-btn--danger {
        background: transparent;
        border-color: ${COLOR.danger};
        color: ${COLOR.danger};
      }

      .wa-btn--danger:hover:not(:disabled) {
        background: ${COLOR.danger}18;
      }

      .wa-btn--sm {
        font-size: 11px;
        padding: 4px 10px;
      }

      .wa-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 12px;
      }

      .wa-card {
        background: ${COLOR.bgCard};
        border: 1px solid ${COLOR.border};
        border-radius: 10px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        transition: border-color 0.15s;
      }

      .wa-card:hover {
        border-color: ${COLOR.borderFocus};
      }

      .wa-card__header {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .wa-card__dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .wa-card__dot--running {
        background: ${COLOR.connected};
        box-shadow: 0 0 6px ${COLOR.connected}88;
      }

      .wa-card__dot--stopped {
        background: ${COLOR.stopped};
        box-shadow: 0 0 6px ${COLOR.stopped}88;
      }

      .wa-card__dot--unpaired {
        background: ${COLOR.unpaired};
      }

      .wa-card__label {
        font-size: 13px;
        font-weight: 700;
        color: ${COLOR.text};
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .wa-card__slot {
        font-size: 10px;
        color: ${COLOR.textDim};
        background: ${COLOR.border};
        padding: 2px 6px;
        border-radius: 4px;
      }

      .wa-card__meta {
        font-size: 11px;
        color: ${COLOR.textDim};
        display: flex;
        gap: 12px;
      }

      .wa-card__meta span {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .wa-card__actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .wa-empty {
        text-align: center;
        padding: 40px 20px;
        color: ${COLOR.textDim};
        font-size: 13px;
        border: 1px dashed ${COLOR.border};
        border-radius: 10px;
      }

      .wa-empty__icon {
        font-size: 32px;
        margin-bottom: 12px;
        display: block;
        opacity: 0.4;
      }

      .wa-error-banner {
        background: #2d070718;
        border: 1px solid ${COLOR.danger};
        border-radius: 8px;
        padding: 10px 14px;
        color: #fca5a5;
        font-size: 12px;
        margin-bottom: 16px;
      }

      /* ── Modal overlay ── */
      .wa-modal-overlay {
        position: fixed;
        inset: 0;
        background: ${COLOR.bgModal};
        backdrop-filter: blur(4px);
        z-index: 9000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .wa-modal {
        background: ${COLOR.bgCard};
        border: 1px solid ${COLOR.borderFocus};
        border-radius: 14px;
        padding: 28px;
        width: 100%;
        max-width: 360px;
        font-family: 'Courier New', Courier, monospace;
        color: ${COLOR.text};
        display: flex;
        flex-direction: column;
        gap: 20px;
        position: relative;
      }

      .wa-modal__close {
        position: absolute;
        top: 14px;
        right: 16px;
        background: none;
        border: none;
        cursor: pointer;
        color: ${COLOR.textDim};
        font-size: 18px;
        line-height: 1;
        padding: 4px;
        transition: color 0.15s;
      }

      .wa-modal__close:hover {
        color: ${COLOR.text};
      }

      .wa-modal__title {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: ${COLOR.textMuted};
      }

      .wa-modal__body {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        min-height: 100px;
        text-align: center;
      }

      /* ── QR container ── */
      .wa-qr-wrap {
        background: #fff;
        padding: 12px;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      /* ── Spinner ── */
      @keyframes wa-spin {
        to { transform: rotate(360deg); }
      }

      .wa-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid ${COLOR.border};
        border-top-color: ${COLOR.accent};
        border-radius: 50%;
        animation: wa-spin 0.8s linear infinite;
      }

      /* ── Status text ── */
      .wa-status-text {
        font-size: 12px;
        color: ${COLOR.textMuted};
        line-height: 1.6;
      }

      .wa-status-text--success {
        color: ${COLOR.connected};
      }

      .wa-status-text--error {
        color: #fca5a5;
      }

      /* ── Checkmark ── */
      .wa-checkmark {
        width: 48px;
        height: 48px;
        background: ${COLOR.connected}22;
        border: 2px solid ${COLOR.connected};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        color: ${COLOR.connected};
      }

      /* ── Refresh indicator ── */
      .wa-refresh-badge {
        font-size: 10px;
        color: ${COLOR.textDim};
        letter-spacing: 0.04em;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Utility helpers ──────────────────────────────────────────────────────

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') node.className = v;
      else if (k === 'style') node.style.cssText = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else {
        node.setAttribute(k, v);
      }
    });
    children.flat().forEach(child => {
      if (child == null) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function statusClass(status) {
    if (status === 'running') return 'wa-card__dot--running';
    if (status === 'stopped') return 'wa-card__dot--stopped';
    return 'wa-card__dot--unpaired';
  }

  function statusLabel(status) {
    if (status === 'running') return 'running';
    if (status === 'stopped') return 'stopped';
    return 'unpaired';
  }

  // ─── Core factory ─────────────────────────────────────────────────────────

  function createInstance(rootEl, options) {
    const { endpoint } = options;

    let accounts = [];
    let refreshTimer = null;
    let currentOverlay = null;
    let currentSSE = null;

    // ── API helpers ──

    async function apiFetch(path, method = 'GET') {
      const res = await fetch(`${endpoint}${path}`, {
        method,
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      if (method !== 'DELETE') return res.json().catch(() => ({}));
      return {};
    }

    async function loadAccounts() {
      try {
        accounts = await apiFetch('/accounts');
        renderPanel();
      } catch (err) {
        renderPanel(err.message);
      }
    }

    async function activateSlot(slot) {
      await apiFetch(`/accounts/${slot}/activate`, 'POST');
      await loadAccounts();
    }

    async function deactivateSlot(slot) {
      await apiFetch(`/accounts/${slot}/deactivate`, 'POST');
      await loadAccounts();
    }

    async function removeSlot(slot) {
      if (!confirm(`Remove WhatsApp account in slot ${slot}? This cannot be undone.`)) return;
      await apiFetch(`/accounts/${slot}`, 'DELETE');
      await loadAccounts();
    }

    // ── Auto-refresh ──

    function startAutoRefresh() {
      stopAutoRefresh();
      refreshTimer = setInterval(() => loadAccounts(), 30_000);
    }

    function stopAutoRefresh() {
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    }

    // ── Card rendering ──

    function buildCard(account) {
      const { slot, status, port, label } = account;

      const dot = el('span', { className: `wa-card__dot ${statusClass(status)}` });
      const labelEl = el('span', { className: 'wa-card__label' }, label || `Slot ${slot}`);
      const slotBadge = el('span', { className: 'wa-card__slot' }, `#${slot}`);
      const cardHeader = el('div', { className: 'wa-card__header' }, dot, labelEl, slotBadge);

      const portSpan = el('span', {}, ':', el('b', {}, port ? String(port) : '—'));
      const statusSpan = el('span', {}, statusLabel(status));
      const meta = el('div', { className: 'wa-card__meta' }, portSpan, statusSpan);

      const actions = el('div', { className: 'wa-card__actions' });

      if (status === 'running') {
        const pauseBtn = el('button', {
          className: 'wa-btn wa-btn--warning wa-btn--sm',
          onClick: async (e) => {
            e.currentTarget.disabled = true;
            e.currentTarget.textContent = '...';
            try { await deactivateSlot(slot); } catch { e.currentTarget.disabled = false; e.currentTarget.textContent = 'Pause'; }
          }
        }, 'Pause');
        actions.appendChild(pauseBtn);
      } else if (status === 'stopped') {
        const resumeBtn = el('button', {
          className: 'wa-btn wa-btn--success wa-btn--sm',
          onClick: async (e) => {
            e.currentTarget.disabled = true;
            e.currentTarget.textContent = '...';
            try { await activateSlot(slot); } catch { e.currentTarget.disabled = false; e.currentTarget.textContent = 'Resume'; }
          }
        }, 'Resume');
        actions.appendChild(resumeBtn);
      }

      if (status !== 'unpaired') {
        const removeBtn = el('button', {
          className: 'wa-btn wa-btn--danger wa-btn--sm',
          onClick: async (e) => {
            e.currentTarget.disabled = true;
            try { await removeSlot(slot); } catch { e.currentTarget.disabled = false; }
          }
        }, 'Remove');
        actions.appendChild(removeBtn);
      }

      return el('div', { className: 'wa-card' }, cardHeader, meta, actions);
    }

    // ── Main panel render ──

    function renderPanel(errorMsg) {
      rootEl.innerHTML = '';

      const panel = el('div', { className: 'wa-panel' });

      // Header
      const titleDot = el('span', { className: 'wa-panel__title-dot' });
      const titleText = el('span', {}, 'WhatsApp Accounts');
      const titleEl = el('div', { className: 'wa-panel__title' }, titleDot, titleText);

      const addBtn = el('button', {
        className: 'wa-btn wa-btn--primary',
        onClick: () => openPairModal(),
      }, '+ Add Account');

      const header = el('div', { className: 'wa-panel__header' }, titleEl, addBtn);
      panel.appendChild(header);

      // Error banner
      if (errorMsg) {
        const banner = el('div', { className: 'wa-error-banner' }, `Failed to load accounts: ${errorMsg}`);
        panel.appendChild(banner);
      }

      // Grid or empty state
      if (accounts.length === 0 && !errorMsg) {
        const icon = el('span', { className: 'wa-empty__icon' }, '📱');
        const msg = el('p', {}, 'No WhatsApp accounts linked yet.');
        const sub = el('p', { style: 'margin-top:6px;font-size:11px;' }, 'Click "+ Add Account" to pair your first account.');
        const empty = el('div', { className: 'wa-empty' }, icon, msg, sub);
        panel.appendChild(empty);
      } else {
        const grid = el('div', { className: 'wa-grid' });
        accounts.forEach(acc => grid.appendChild(buildCard(acc)));
        panel.appendChild(grid);
      }

      rootEl.appendChild(panel);
    }

    // ── Pair modal ──

    function closeModal() {
      if (currentSSE) { currentSSE.close(); currentSSE = null; }
      if (currentOverlay) { currentOverlay.remove(); currentOverlay = null; }
    }

    function openPairModal() {
      if (currentOverlay) return; // Already open

      const body = el('div', { className: 'wa-modal__body' });

      const closeBtn = el('button', {
        className: 'wa-modal__close',
        title: 'Close',
        onClick: () => closeModal(),
      }, '×');

      const title = el('div', { className: 'wa-modal__title' }, 'Link New Account');
      const modal = el('div', { className: 'wa-modal' }, closeBtn, title, body);

      const overlay = el('div', {
        className: 'wa-modal-overlay',
        onClick: (e) => { if (e.target === overlay) closeModal(); },
      }, modal);

      document.body.appendChild(overlay);
      currentOverlay = overlay;

      // Begin SSE pairing
      startPairingSSE(body);
    }

    function setModalBody(bodyEl, content) {
      bodyEl.innerHTML = '';
      if (Array.isArray(content)) {
        content.forEach(c => { if (c) bodyEl.appendChild(c); });
      } else {
        bodyEl.appendChild(content);
      }
    }

    function showSpinner(bodyEl, message) {
      const spinner = el('div', { className: 'wa-spinner' });
      const txt = el('p', { className: 'wa-status-text' }, message || 'Connecting...');
      setModalBody(bodyEl, [spinner, txt]);
    }

    function renderQR(bodyEl, dataURL) {
      // dataURL is a base64 PNG generated server-side — no JS QR library needed.
      const wrap = el('div', { className: 'wa-qr-wrap' });
      const img = el('img', { src: dataURL, width: '256', height: '256', alt: 'WhatsApp QR code' });
      wrap.appendChild(img);
      const hint = el('p', { className: 'wa-status-text' },
        'Scan with WhatsApp → Linked Devices → Link a Device');
      setModalBody(bodyEl, [wrap, hint]);
    }

    function showPaired(bodyEl, slot) {
      const check = el('div', { className: 'wa-checkmark' }, '✓');
      const txt = el('p', { className: 'wa-status-text wa-status-text--success' },
        `Slot ${slot} paired! Activating...`);
      setModalBody(bodyEl, [check, txt]);
    }

    function showTimeout(bodyEl) {
      const icon = el('span', { style: 'font-size:32px;opacity:0.5;' }, '⏱');
      const txt = el('p', { className: 'wa-status-text' }, 'QR expired — please try again.');
      const retryBtn = el('button', {
        className: 'wa-btn wa-btn--primary',
        onClick: () => startPairingSSE(bodyEl),
      }, 'Retry');
      setModalBody(bodyEl, [icon, txt, retryBtn]);
    }

    function showError(bodyEl, msg) {
      const icon = el('span', { style: 'font-size:32px;opacity:0.5;' }, '⚠');
      const txt = el('p', { className: 'wa-status-text wa-status-text--error' }, msg || 'An error occurred.');
      const retryBtn = el('button', {
        className: 'wa-btn wa-btn--ghost',
        onClick: () => startPairingSSE(bodyEl),
      }, 'Try Again');
      setModalBody(bodyEl, [icon, txt, retryBtn]);
    }

    function startPairingSSE(bodyEl) {
      // Close any existing SSE connection
      if (currentSSE) { currentSSE.close(); currentSSE = null; }

      showSpinner(bodyEl, 'Connecting to pairing service...');

      let assignedSlot = null;

      const sse = new EventSource(`${endpoint}/accounts/pair`);
      currentSSE = sse;

      sse.addEventListener('slot', (e) => {
        assignedSlot = e.data;
        showSpinner(bodyEl, `Slot ${assignedSlot} reserved — generating QR...`);
      });

      sse.addEventListener('qr', (e) => {
        renderQR(bodyEl, e.data);
      });

      sse.addEventListener('paired', async (e) => {
        const pairedSlot = e.data || assignedSlot;
        sse.close();
        currentSSE = null;

        showPaired(bodyEl, pairedSlot);

        try {
          await activateSlot(pairedSlot);
        } catch (_) {
          // Activation failed — account is still paired, list will reflect it
          await loadAccounts();
        }

        // Short grace period so user sees the success state
        await new Promise(r => setTimeout(r, 1200));
        closeModal();
      });

      sse.addEventListener('timeout', () => {
        sse.close();
        currentSSE = null;
        showTimeout(bodyEl);
      });

      sse.addEventListener('error', (e) => {
        // SSE fires a generic error event when the connection drops
        // Only treat as fatal if we haven't already handled the stream
        if (!currentSSE) return; // Already cleaned up
        sse.close();
        currentSSE = null;

        const msg = e.data || 'Connection lost';
        showError(bodyEl, msg);
      });

      // Fallback: native EventSource onerror (network failure, server down)
      sse.onerror = () => {
        if (!currentSSE) return;
        sse.close();
        currentSSE = null;
        showError(bodyEl, 'Could not reach wa-manager. Is it running?');
      };
    }

    // ── Lifecycle ──

    function destroy() {
      stopAutoRefresh();
      closeModal();
      rootEl.innerHTML = '';
    }

    // ── Boot ──

    injectStyles();
    renderPanel();
    loadAccounts();
    startAutoRefresh();

    return { loadAccounts, destroy };
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    /**
     * Initialise a WhatsApp Manager panel inside the given container.
     *
     * @param {string|HTMLElement} container - element id or DOM node
     * @param {Object} options
     * @param {string} options.endpoint - base URL of wa-manager API, e.g. 'http://localhost:8131'
     * @returns {{ loadAccounts: Function, destroy: Function }}
     */
    init(container, options = {}) {
      const rootEl = typeof container === 'string'
        ? document.getElementById(container)
        : container;

      if (!rootEl) {
        console.error(`HtmxRWhatsappManager: container "${container}" not found`);
        return null;
      }

      if (!options.endpoint) {
        console.error('HtmxRWhatsappManager: options.endpoint is required');
        return null;
      }

      // Strip trailing slash for consistency
      options.endpoint = options.endpoint.replace(/\/$/, '');

      return createInstance(rootEl, options);
    },
  };

})();

window.HtmxRWhatsappManager = HtmxRWhatsappManager;
