/**
 * htmx-r Toast Notification Extension
 * Lightweight, zero-dependency toast notifications with HTMX response integration.
 *
 * Usage:
 *   HtmxRToast.success('Changes saved!')
 *   HtmxRToast.error('Something went wrong.')
 *   HtmxRToast.info('Session started.', { duration: 5000 })
 *   HtmxRToast.show('Custom message', { type: 'warning', position: 'bottom-left' })
 *
 * HTMX integration — respond with HX-Trigger header:
 *   HX-Trigger: {"htmxrToast": {"message": "Saved!", "type": "success"}}
 */

const HtmxRToast = {
  _container: null,
  _defaults: {
    duration: 3500,
    position: 'bottom-right', // 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center'
    maxVisible: 5,
  },

  // Type → color config
  _types: {
    success: { bg: '#052e16', border: '#16a34a', text: '#86efac', icon: '✓' },
    error:   { bg: '#2d0707', border: '#dc2626', text: '#fca5a5', icon: '✕' },
    warning: { bg: '#1c1400', border: '#d97706', text: '#fcd34d', icon: '⚠' },
    info:    { bg: '#0c1a2e', border: '#3b82f6', text: '#93c5fd', icon: 'ℹ' },
  },

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {Object} [options]
   * @param {string} [options.type='info'] - 'success' | 'error' | 'warning' | 'info'
   * @param {number} [options.duration] - ms before auto-dismiss (0 = sticky)
   * @param {string} [options.position] - override default position
   * @param {string} [options.title] - optional bold title above message
   * @param {Function} [options.onDismiss] - callback when toast is dismissed
   */
  show(message, options = {}) {
    const {
      type = 'info',
      duration = this._defaults.duration,
      position = this._defaults.position,
      title,
      onDismiss,
    } = options;

    const container = this._getContainer(position);
    const style = this._types[type] || this._types.info;

    // Enforce max visible
    const toasts = container.querySelectorAll('.htmx-r-toast');
    if (toasts.length >= this._defaults.maxVisible) {
      toasts[0].remove();
    }

    const toast = document.createElement('div');
    toast.className = 'htmx-r-toast';
    toast.style.cssText = `
      display: flex; align-items: flex-start; gap: 10px;
      padding: 12px 14px;
      background: ${style.bg};
      border: 1px solid ${style.border};
      border-radius: 10px;
      color: ${style.text};
      font-size: 13px; line-height: 1.5;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      pointer-events: all;
      cursor: default;
      max-width: 360px;
      word-break: break-word;
      opacity: 0; transform: translateX(12px);
      transition: opacity 0.2s, transform 0.2s;
    `;

    // Icon
    const icon = document.createElement('span');
    icon.style.cssText = `
      flex-shrink: 0; width: 18px; height: 18px;
      background: ${style.border}33;
      border: 1px solid ${style.border};
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700; color: ${style.text};
    `;
    icon.textContent = style.icon;

    // Body
    const body = document.createElement('div');
    body.style.flex = '1';
    if (title) {
      const titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-weight: 700; margin-bottom: 2px;';
      titleEl.textContent = title;
      body.appendChild(titleEl);
    }
    const msg = document.createElement('div');
    msg.style.color = 'rgba(255,255,255,0.75)';
    msg.textContent = message;
    body.appendChild(msg);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      background: none; border: none; cursor: pointer;
      color: ${style.text}; opacity: 0.5; padding: 0; margin: 0;
      font-size: 14px; line-height: 1; flex-shrink: 0;
    `;
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this._dismiss(toast, onDismiss));

    toast.appendChild(icon);
    toast.appendChild(body);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => this._dismiss(toast, onDismiss), duration);
    }

    return toast;
  },

  /** Shorthand methods */
  success(message, options = {}) { return this.show(message, { ...options, type: 'success' }); },
  error(message, options = {})   { return this.show(message, { ...options, type: 'error' }); },
  warning(message, options = {}) { return this.show(message, { ...options, type: 'warning' }); },
  info(message, options = {})    { return this.show(message, { ...options, type: 'info' }); },

  /**
   * Configure global defaults.
   * @param {Object} options
   */
  configure(options = {}) {
    Object.assign(this._defaults, options);
  },

  // Internal: get or create the toast container for a position
  _getContainer(position) {
    const id = `htmx-r-toast-container--${position}`;
    let container = document.getElementById(id);
    if (container) return container;

    const posStyles = {
      'top-right':    'top: 20px; right: 20px;',
      'top-left':     'top: 20px; left: 20px;',
      'bottom-right': 'bottom: 20px; right: 20px;',
      'bottom-left':  'bottom: 20px; left: 20px;',
      'top-center':   'top: 20px; left: 50%; transform: translateX(-50%);',
    };

    container = document.createElement('div');
    container.id = id;
    container.style.cssText = `
      position: fixed; z-index: 9999;
      display: flex; flex-direction: column; gap: 8px;
      pointer-events: none;
      ${posStyles[position] || posStyles['bottom-right']}
    `;
    document.body.appendChild(container);
    return container;
  },

  // Internal: animate out and remove a toast
  _dismiss(toast, onDismiss) {
    if (!toast.parentNode) return;
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(12px)';
    setTimeout(() => {
      toast.remove();
      if (onDismiss) onDismiss();
    }, 200);
  },
};

// HTMX event integration — fires when server responds with HX-Trigger
document.addEventListener('htmx:trigger', (e) => {
  const detail = e.detail?.trigger;
  if (detail?.htmxrToast) {
    const { message, type, title, duration } = detail.htmxrToast;
    HtmxRToast.show(message, { type, title, duration });
  }
});

window.HtmxRToast = HtmxRToast;
