/**
 * htmx-r Chat Extension
 * AI chat UI utilities: message rendering, typing indicators, auto-scroll, state management
 *
 * Usage:
 *   HtmxRChat.appendMessage(container, { role: 'assistant', content: 'Hello!' })
 *   HtmxRChat.setTyping(container, true)
 *   HtmxRChat.scrollToBottom(container)
 *
 * CSS requirements: include htmx-r-chat.css or define .htmx-r-chat-* classes
 */

const HtmxRChat = {

  /**
   * Append a message bubble to the chat container.
   * Supports 'user' and 'assistant' roles.
   * @param {HTMLElement|string} container - element or selector
   * @param {Object} options
   * @param {string} options.role - 'user' | 'assistant'
   * @param {string} options.content - message text (markdown ** bold ** supported)
   * @param {string} [options.avatarText] - emoji or initials for avatar (assistant only)
   * @param {boolean} [options.animate=true] - fade-in animation
   */
  appendMessage(container, options = {}) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) { console.warn('HtmxRChat: container not found'); return; }

    const { role = 'user', content = '', avatarText = '🤖', animate = true } = options;
    const isUser = role === 'user';

    const row = document.createElement('div');
    row.className = `htmx-r-chat-row htmx-r-chat-row--${role}`;
    row.style.cssText = `
      display: flex;
      justify-content: ${isUser ? 'flex-end' : 'flex-start'};
      align-items: flex-end;
      gap: 8px;
      margin-bottom: 16px;
      ${animate ? 'opacity: 0; transform: translateY(8px); transition: opacity 0.2s, transform 0.2s;' : ''}
    `;

    if (!isUser) {
      const avatar = document.createElement('div');
      avatar.className = 'htmx-r-chat-avatar';
      avatar.style.cssText = `
        width: 28px; height: 28px; flex-shrink: 0;
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        border-radius: 8px; display: flex; align-items: center;
        justify-content: center; font-size: 13px;
      `;
      avatar.textContent = avatarText;
      row.appendChild(avatar);
    }

    const bubble = document.createElement('div');
    bubble.className = `htmx-r-chat-bubble htmx-r-chat-bubble--${role}`;
    bubble.style.cssText = `
      max-width: 72%;
      padding: 12px 16px;
      border-radius: ${isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};
      background: ${isUser ? '#1f2937' : '#1e1b4b'};
      border: 1px solid ${isUser ? '#374151' : '#312e81'};
      font-size: 14px;
      line-height: 1.6;
      color: #e2e4ef;
      word-break: break-word;
    `;
    bubble.innerHTML = this._formatContent(content);
    row.appendChild(bubble);

    el.appendChild(row);

    if (animate) {
      requestAnimationFrame(() => {
        row.style.opacity = '1';
        row.style.transform = 'translateY(0)';
      });
    }

    this.scrollToBottom(el);
    return row;
  },

  /**
   * Show or hide the typing indicator in the container.
   * Creates the indicator if it doesn't exist; removes it when hidden.
   * @param {HTMLElement|string} container
   * @param {boolean} visible
   * @param {string} [avatarText='🤖']
   */
  setTyping(container, visible, avatarText = '🤖') {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;

    const existingIndicator = el.querySelector('.htmx-r-chat-typing');

    if (!visible) {
      if (existingIndicator) existingIndicator.remove();
      return;
    }

    if (existingIndicator) return; // Already showing

    const row = document.createElement('div');
    row.className = 'htmx-r-chat-typing htmx-r-chat-row htmx-r-chat-row--assistant';
    row.style.cssText = `
      display: flex; justify-content: flex-start;
      align-items: flex-end; gap: 8px; margin-bottom: 16px;
    `;

    const avatar = document.createElement('div');
    avatar.style.cssText = `
      width: 28px; height: 28px; flex-shrink: 0;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      border-radius: 8px; display: flex; align-items: center;
      justify-content: center; font-size: 13px;
    `;
    avatar.textContent = avatarText;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      padding: 12px 16px;
      border-radius: 18px 18px 18px 4px;
      background: #1e1b4b; border: 1px solid #312e81;
      display: flex; gap: 4px; align-items: center;
    `;

    // Inject bounce keyframe if not already present
    if (!document.getElementById('htmx-r-chat-bounce')) {
      const style = document.createElement('style');
      style.id = 'htmx-r-chat-bounce';
      style.textContent = `
        @keyframes htmxrChatBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `;
      document.head.appendChild(style);
    }

    [0, 1, 2].forEach((i) => {
      const dot = document.createElement('span');
      dot.style.cssText = `
        width: 7px; height: 7px; background: #818cf8;
        border-radius: 50%; display: inline-block;
        animation: htmxrChatBounce 1.2s ease-in-out ${i * 0.2}s infinite;
      `;
      bubble.appendChild(dot);
    });

    row.appendChild(avatar);
    row.appendChild(bubble);
    el.appendChild(row);
    this.scrollToBottom(el);
  },

  /**
   * Smooth-scroll the container to its bottom.
   * @param {HTMLElement|string} container
   * @param {boolean} [smooth=true]
   */
  scrollToBottom(container, smooth = true) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  },

  /**
   * Enable or disable the chat input and send button.
   * @param {HTMLElement|string} inputEl - the <input> or <textarea>
   * @param {boolean} disabled
   */
  setInputState(inputEl, disabled) {
    const el = typeof inputEl === 'string' ? document.querySelector(inputEl) : inputEl;
    if (!el) return;
    el.disabled = disabled;

    // Also disable sibling submit button if in a <form>
    const form = el.closest('form');
    if (form) {
      const btn = form.querySelector('button[type="submit"], button:not([type])');
      if (btn) btn.disabled = disabled;
    }
  },

  /**
   * Update a `data-state` attribute on an element (htmx-r state pattern).
   * Drives CSS `[data-state="..."]` selectors for show/hide logic.
   * @param {HTMLElement|string} el
   * @param {string} state
   */
  setState(el, state) {
    const target = typeof el === 'string' ? document.querySelector(el) : el;
    if (!target) return;
    target.dataset.state = state;
    target.dispatchEvent(new CustomEvent('htmxr:statechange', { detail: { state }, bubbles: true }));
  },

  /**
   * Clear all messages from the container (keeps typing indicator logic safe).
   * @param {HTMLElement|string} container
   */
  clearMessages(container) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    el.querySelectorAll('.htmx-r-chat-row').forEach(row => row.remove());
  },

  // Internal: convert **bold** markdown and newlines to HTML
  _formatContent(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  },
};

window.HtmxRChat = HtmxRChat;
