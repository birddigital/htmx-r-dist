/**
 * HTMX-R (HTMX Reactive)
 * Pure HTML attribute-based reactive state management
 *
 * Extends HTMX's philosophy: Declarative, HTML-first, no inline JavaScript
 * State lives in HTML attributes, CSS handles reactivity
 *
 * Core attributes:
 *   data-state-{key}="{value}"          Declare state on a container (hx-ext="reactive")
 *   data-when="{key}:{value}"           Show element when state matches; hide otherwise
 *   hx-state-set="{key}:{value}"        Set state to a specific value on click
 *   hx-state-toggle="{key}"             Cycle state through values on click
 *   hx-state-on-request="{key}:{value}" Set state when HTMX request begins
 *   hx-state-on-response="{key}:{value}"Set state when HTMX response arrives
 *   hx-state-on-error="{key}:{value}"   Set state on HTMX error
 *   hx-state-on-swap="{key}:{value}"    Set state after HTMX DOM swap
 *   hx-state-persist="true"            Persist state to localStorage
 *   hx-state-sync-url="{param}"         Mirror state to URL query param
 *   data-state-value="{key}"            Sync input value from state (state → input)
 *
 * Binding extensions (v1.1):
 *   hx-state-on-input="{key}"           Mirror input.value to state on each keystroke
 *   hx-state-on-input="{key}:length"    Mirror input.value.length to state on each keystroke
 *   data-state-text="{key}"             Render state value as element textContent
 *   data-class-when="{key}:{val}:{cls}" Add CSS classes when state matches; requires
 *                                       data-class-default="{cls}" for the inactive state
 *
 * Interactive primitives (v1.2):
 *   hx-state-popover="{key}"            Click-to-toggle with outside-click/Escape dismiss
 *   hx-state-on-hover="{key}"           Set state true on mouseenter, false on mouseleave
 *   hx-state-on-hover="{key}:{ms}"      Same with delay (ms) before showing
 *   data-key-nav="{key}"                Arrow-key navigation through [data-key-nav-item] children
 *   data-transition="{preset}"          Animate data-when show/hide (fade|slide-down|slide-up|scale)
 *   data-transition-duration="{ms}"     Custom transition duration (default: 150ms)
 */

(function() {
  'use strict';

  // HTMX-R Extension Definition
  htmx.defineExtension('reactive', {

    // Initialize extension
    onEvent: function(name, evt) {
      const element = evt.detail.elt;

      // Handle state changes on HTMX lifecycle events
      switch(name) {
        case 'htmx:beforeRequest':
          applyStateChange(element, 'hx-state-on-request');
          break;
        case 'htmx:afterRequest':
          applyStateChange(element, 'hx-state-on-response');
          break;
        case 'htmx:responseError':
        case 'htmx:sendError':
          applyStateChange(element, 'hx-state-on-error');
          break;
        case 'htmx:afterSwap':
          applyStateChange(element, 'hx-state-on-swap');
          break;
      }
    }
  });

  // Apply state change from attribute
  function applyStateChange(element, attrName) {
    const stateChange = element.getAttribute(attrName);
    if (!stateChange) return;

    // Parse "key:value" format
    const [key, value] = stateChange.split(':').map(s => s.trim());
    if (!key || !value) return;

    // Find state container
    const container = findStateContainer(element, key);
    if (!container) return;

    // Update state attribute
    container.setAttribute('data-state-' + key, value);

    // Persist to localStorage if enabled
    persistState(container, key, value);

    // Sync to URL if enabled
    syncToURL(container, key, value);

    // Dispatch custom event for state change
    container.dispatchEvent(new CustomEvent('htmx-r:state-change', {
      detail: { key, value, element },
      bubbles: true
    }));
  }

  // Find closest state container
  function findStateContainer(element, key) {
    return element.closest('[data-state-' + key + ']');
  }

  // Persist state to localStorage
  function persistState(container, key, value) {
    if (container.getAttribute('hx-state-persist') !== 'true') return;

    try {
      const storageKey = 'htmx-r:' + key;
      localStorage.setItem(storageKey, value);
    } catch (e) {
      console.warn('HTMX-R: Failed to persist state to localStorage', e);
    }
  }

  // Sync state to URL
  function syncToURL(container, key, value) {
    const urlParam = container.getAttribute('hx-state-sync-url');
    if (!urlParam) return;

    try {
      const url = new URL(window.location);
      url.searchParams.set(urlParam, value);
      window.history.replaceState({}, '', url);
    } catch (e) {
      console.warn('HTMX-R: Failed to sync state to URL', e);
    }
  }

  // Restore state from URL
  function restoreFromURL(container) {
    const urlParam = container.getAttribute('hx-state-sync-url');
    if (!urlParam) return;

    try {
      const url = new URL(window.location);
      const value = url.searchParams.get(urlParam);

      if (value !== null) {
        // Find the state key by looking at data-state-* attributes
        Array.from(container.attributes).forEach(attr => {
          if (attr.name.startsWith('data-state-')) {
            const key = attr.name.replace('data-state-', '');
            container.setAttribute('data-state-' + key, value);
            container.dispatchEvent(new CustomEvent('htmx-r:state-change', {
              detail: { key, value, element: container },
              bubbles: true
            }));
          }
        });
      }
    } catch (e) {
      console.warn('HTMX-R: Failed to restore state from URL', e);
    }
  }

  // Restore state from localStorage
  function restoreState(container) {
    if (container.getAttribute('hx-state-persist') !== 'true') return;

    try {
      // Get all state attributes on this container
      Array.from(container.attributes).forEach(attr => {
        if (attr.name.startsWith('data-state-')) {
          const key = attr.name.replace('data-state-', '');
          const storageKey = 'htmx-r:' + key;
          const saved = localStorage.getItem(storageKey);

          if (saved !== null) {
            container.setAttribute('data-state-' + key, saved);
            container.dispatchEvent(new CustomEvent('htmx-r:state-change', {
              detail: { key, value: saved, element: container },
              bubbles: true
            }));
          }
        }
      });
    } catch (e) {
      console.warn('HTMX-R: Failed to restore state from localStorage', e);
    }
  }

  // Transitioning state tracker
  const transitioning = new WeakMap();

  // Handle hx-state-set (direct state setting)
  document.addEventListener('click', function(e) {
    const setter = e.target.closest('[hx-state-set]');
    if (!setter) return;

    const stateChange = setter.getAttribute('hx-state-set');
    if (!stateChange) return;

    // Parse "key:value" format
    const [key, value] = stateChange.split(':').map(s => s.trim());
    if (!key || !value) return;

    const container = findStateContainer(setter, key);
    if (!container) return;

    // Set state to specific value
    container.setAttribute('data-state-' + key, value);

    // Persist to localStorage if enabled
    persistState(container, key, value);

    // Sync to URL if enabled
    syncToURL(container, key, value);

    // Dispatch state change event
    container.dispatchEvent(new CustomEvent('htmx-r:state-change', {
      detail: { key, value, element: setter },
      bubbles: true
    }));
  });

  // Handle state toggles
  document.addEventListener('click', function(e) {
    const toggle = e.target.closest('[hx-state-toggle]');
    if (!toggle) return;

    const stateKey = toggle.getAttribute('hx-state-toggle');
    if (!stateKey) return;

    const container = findStateContainer(toggle, stateKey);
    if (!container) return;

    // Prevent rapid clicks causing race conditions
    if (transitioning.get(container)) return;
    transitioning.set(container, true);

    const currentValue = container.getAttribute('data-state-' + stateKey);

    // Get toggle values (default: true/false)
    const valuesAttr = toggle.getAttribute('hx-state-values');
    let values;

    if (valuesAttr) {
      values = valuesAttr.split(',').map(v => v.trim());
    } else {
      values = ['true', 'false'];
    }

    // Toggle to next value (cycle through values)
    const currentIndex = values.indexOf(currentValue);
    const nextIndex = (currentIndex + 1) % values.length;
    const newValue = values[nextIndex];

    // Update state
    container.setAttribute('data-state-' + stateKey, newValue);

    // Persist to localStorage if enabled
    persistState(container, stateKey, newValue);

    // Sync to URL if enabled
    syncToURL(container, stateKey, newValue);

    // Update checkbox state if toggle is a checkbox
    if (toggle.type === 'checkbox') {
      toggle.checked = (newValue === values[0]);
    }

    // Dispatch state change event
    container.dispatchEvent(new CustomEvent('htmx-r:state-change', {
      detail: { key: stateKey, value: newValue, element: toggle },
      bubbles: true
    }));

    // Clear transition flag after a microtask (allows CSS to update)
    requestAnimationFrame(() => transitioning.delete(container));
  });

  // Handle state changes on form inputs
  document.addEventListener('change', function(e) {
    const stateToggle = e.target.getAttribute('hx-state-toggle');
    if (!stateToggle) return;

    const container = findStateContainer(e.target, stateToggle);
    if (!container) return;

    // Skip if click handler already processed this (prevents double-toggle on checkboxes)
    if (e.target.type === 'checkbox' && transitioning.get(container)) return;

    // For checkboxes with custom values, use those instead of true/false
    let value;
    if (e.target.type === 'checkbox') {
      const valuesAttr = e.target.getAttribute('hx-state-values');
      if (valuesAttr) {
        const values = valuesAttr.split(',').map(v => v.trim());
        value = e.target.checked ? values[0] : values[1];
      } else {
        value = e.target.checked.toString();
      }
    } else {
      value = e.target.value;
    }

    container.setAttribute('data-state-' + stateToggle, value);

    // Persist to localStorage if enabled
    persistState(container, stateToggle, value);

    // Sync to URL if enabled
    syncToURL(container, stateToggle, value);

    container.dispatchEvent(new CustomEvent('htmx-r:state-change', {
      detail: { key: stateToggle, value, element: e.target },
      bubbles: true
    }));
  });

  // Sync form values with state (state → input, for data-state-value)
  document.addEventListener('htmx-r:state-change', function(e) {
    const { key, value } = e.detail;
    const container = e.target;

    // Update all inputs with data-state-value attribute
    const inputs = container.querySelectorAll('[data-state-value="' + key + '"]');
    inputs.forEach(input => {
      if (input.type === 'checkbox') {
        input.checked = (value === 'true' || value === input.getAttribute('data-state-values')?.split(',')[0]);
      } else {
        input.value = value;
      }
    });
  });

  /**
   * Dynamic data-when handler
   * Instead of relying solely on CSS rules (which must be hardcoded per state
   * name + value combo), this listener dynamically shows/hides data-when
   * elements for ANY state name and value combination.
   */
  document.addEventListener('htmx-r:state-change', function(e) {
    const { key, value } = e.detail;
    const container = e.target;

    // Find all data-when elements within this container that match this key
    const whenElements = container.querySelectorAll('[data-when^="' + key + ':"]');
    whenElements.forEach(el => {
      const whenAttr = el.getAttribute('data-when');
      const whenValue = whenAttr.substring(key.length + 1); // after "key:"
      // Skip elements being handled by the transition system
      if (el.hasAttribute('data-transition') || el.hasAttribute('data-htmxr-transitioning')) return;

      if (whenValue === value) {
        el.style.display = '';
        el.removeAttribute('data-htmx-r-hidden');
      } else {
        el.style.display = 'none';
        el.setAttribute('data-htmx-r-hidden', 'true');
      }
    });
  });

  // ── BINDING EXTENSIONS v1.1 ───────────────────────────────────────────

  /**
   * hx-state-on-input  —  input → state binding (one-way, on each keystroke)
   *
   * Mirrors an input element's value (or a property of it) to a state key
   * whenever the user types. The state container must already declare
   * data-state-{key} as an ancestor.
   *
   * Usage:
   *   hx-state-on-input="key"          stores el.value as state key
   *   hx-state-on-input="key:length"   stores el.value.length as state key
   *   hx-state-on-input="key:checked"  stores el.checked (boolean inputs)
   *
   * Example — character counter:
   *   <div data-state-char-count="0" hx-ext="reactive">
   *     <input hx-state-on-input="char-count:length" maxlength="17">
   *     <span data-state-text="char-count">0</span>/17
   *   </div>
   */
  document.addEventListener('input', function(e) {
    const attr = e.target.getAttribute('hx-state-on-input');
    if (!attr) return;

    const colonIdx = attr.indexOf(':');
    const key   = colonIdx === -1 ? attr.trim() : attr.slice(0, colonIdx).trim();
    const prop  = colonIdx === -1 ? null         : attr.slice(colonIdx + 1).trim();

    if (!key) return;

    const rawValue = e.target.value;
    const value = prop ? String(rawValue[prop] !== undefined ? rawValue[prop] : rawValue) : rawValue;

    const container = findStateContainer(e.target, key);
    if (!container) return;

    container.setAttribute('data-state-' + key, value);
    persistState(container, key, value);
    syncToURL(container, key, value);

    container.dispatchEvent(new CustomEvent('htmx-r:state-change', {
      detail: { key, value, element: e.target },
      bubbles: true
    }));
  });

  /**
   * data-state-text  —  state → textContent binding
   *
   * Renders the current state value as the textContent of any element
   * marked with data-state-text="{key}". Updates live on every state change.
   * Initial value is set during initStateContainers via htmx-r:state-change.
   *
   * Usage:
   *   <span data-state-text="char-count">0</span>
   *
   * Pairs naturally with hx-state-on-input for character counters,
   * live computed values, and derived displays.
   */
  document.addEventListener('htmx-r:state-change', function(e) {
    const { key, value } = e.detail;

    // Update all matching text elements anywhere in the document
    // (not just inside the container — allows text displays to live outside state scope)
    document.querySelectorAll('[data-state-text="' + key + '"]').forEach(function(el) {
      el.textContent = value;
    });
  });

  /**
   * data-class-when  —  state → CSS class binding
   *
   * Adds a set of CSS classes to an element when a state key matches a value,
   * and removes them (restoring data-class-default) when it does not.
   * Eliminates the need for Alpine.js :class bindings for active-state UI.
   *
   * Usage:
   *   data-class-when="{key}:{value}:{class1} {class2} ..."
   *   data-class-default="{class1} {class2} ..."   (optional fallback classes)
   *
   * Example — condition toggle buttons (New / Used / CPO):
   *   <div data-state-condition="new" hx-ext="reactive">
   *     <button hx-state-set="condition:new"
   *             data-class-when="condition:new:bg-blue-600 text-white"
   *             data-class-default="bg-white text-gray-600">New</button>
   *     <button hx-state-set="condition:used"
   *             data-class-when="condition:used:bg-blue-600 text-white"
   *             data-class-default="bg-white text-gray-600">Used</button>
   *   </div>
   *
   * Note: The element does NOT need to be inside the state container —
   * class updates are applied document-wide so overlay UIs work correctly.
   */
  document.addEventListener('htmx-r:state-change', function(e) {
    const { key, value } = e.detail;

    // Find all elements with data-class-when starting with this key
    document.querySelectorAll('[data-class-when^="' + key + ':"]').forEach(function(el) {
      const attr = el.getAttribute('data-class-when');

      // Parse format: "key:matchValue:class1 class2 ..."
      // Use indexOf to support colons inside class names (unlikely but safe)
      const firstColon  = attr.indexOf(':');
      const secondColon = attr.indexOf(':', firstColon + 1);
      if (firstColon === -1 || secondColon === -1) return;

      const whenKey     = attr.slice(0, firstColon).trim();
      const whenValue   = attr.slice(firstColon + 1, secondColon).trim();
      const activeClasses   = attr.slice(secondColon + 1).trim().split(/\s+/).filter(Boolean);
      const defaultClasses  = (el.getAttribute('data-class-default') || '').split(/\s+/).filter(Boolean);

      if (whenKey !== key) return;

      if (value === whenValue) {
        // Activate: remove default classes, add active classes
        defaultClasses.forEach(function(c) { el.classList.remove(c); });
        activeClasses.forEach(function(c)  { el.classList.add(c);    });
      } else {
        // Deactivate: remove active classes, restore default classes
        activeClasses.forEach(function(c)  { el.classList.remove(c); });
        defaultClasses.forEach(function(c) { el.classList.add(c);    });
      }
    });
  });

  // ── POPOVER / DROPDOWN (v1.2) ────────────────────────────────────────

  /**
   * hx-state-popover  —  click-to-toggle floating content with outside-click dismiss
   *
   * Toggles a state key between "open" and "closed" on click.
   * Clicking outside the popover container (or pressing Escape) closes it.
   * This is the foundation for dropdowns, select menus, comboboxes, and popovers.
   *
   * Usage:
   *   <div data-state-menu="closed" hx-ext="reactive">
   *     <button hx-state-popover="menu">Toggle</button>
   *     <div data-when="menu:open" class="dropdown-panel">
   *       ... dropdown content ...
   *     </div>
   *   </div>
   *
   * The attribute goes on the trigger element. The container must declare
   * data-state-{key}="closed". Content shown via data-when="{key}:open".
   */
  document.addEventListener('click', function(e) {
    var trigger = e.target.closest('[hx-state-popover]');

    if (trigger) {
      e.stopPropagation();
      var key = trigger.getAttribute('hx-state-popover').trim();
      var container = findStateContainer(trigger, key);
      if (!container) return;

      var current = container.getAttribute('data-state-' + key);
      var next = current === 'open' ? 'closed' : 'open';

      container.setAttribute('data-state-' + key, next);
      persistState(container, key, next);
      syncToURL(container, key, next);
      container.dispatchEvent(new CustomEvent('htmx-r:state-change', {
        detail: { key: key, value: next, element: trigger },
        bubbles: true
      }));
      return;
    }

    // Outside-click: close any open popovers
    var openContainers = document.querySelectorAll('[hx-state-popover]');
    var seen = new Set();
    openContainers.forEach(function(el) {
      var key = el.getAttribute('hx-state-popover').trim();
      var container = findStateContainer(el, key);
      if (!container || seen.has(container)) return;
      seen.add(container);

      if (container.getAttribute('data-state-' + key) === 'open') {
        // Only close if click is outside the container
        if (!container.contains(e.target)) {
          container.setAttribute('data-state-' + key, 'closed');
          persistState(container, key, 'closed');
          syncToURL(container, key, 'closed');
          container.dispatchEvent(new CustomEvent('htmx-r:state-change', {
            detail: { key: key, value: 'closed', element: el },
            bubbles: true
          }));
        }
      }
    });
  });

  // Escape key closes all open popovers
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    var triggers = document.querySelectorAll('[hx-state-popover]');
    var seen = new Set();
    triggers.forEach(function(el) {
      var key = el.getAttribute('hx-state-popover').trim();
      var container = findStateContainer(el, key);
      if (!container || seen.has(container)) return;
      seen.add(container);

      if (container.getAttribute('data-state-' + key) === 'open') {
        container.setAttribute('data-state-' + key, 'closed');
        persistState(container, key, 'closed');
        syncToURL(container, key, 'closed');
        container.dispatchEvent(new CustomEvent('htmx-r:state-change', {
          detail: { key: key, value: 'closed', element: el },
          bubbles: true
        }));
      }
    });
  });

  // ── HOVER TRIGGER (v1.2) ────────────────────────────────────────────

  /**
   * hx-state-on-hover="{key}"  —  set state on mouseenter, clear on mouseleave
   *
   * Sets the state key to "true" on mouseenter and "false" on mouseleave.
   * Perfect for tooltips, hover cards, and preview popups.
   *
   * Usage:
   *   <div data-state-tip="false" hx-ext="reactive">
   *     <span hx-state-on-hover="tip">Hover me</span>
   *     <div data-when="tip:true" class="tooltip">Tooltip content</div>
   *   </div>
   *
   * Optional delay (ms) to prevent flicker:
   *   hx-state-on-hover="tip:300"   — 300ms delay before showing
   */
  var hoverTimers = new WeakMap();

  document.addEventListener('mouseenter', function(e) {
    var el = e.target.closest('[hx-state-on-hover]');
    if (!el) return;

    var attr = el.getAttribute('hx-state-on-hover').trim();
    var colonIdx = attr.indexOf(':');
    var key   = colonIdx === -1 ? attr : attr.slice(0, colonIdx).trim();
    var delay = colonIdx === -1 ? 0   : parseInt(attr.slice(colonIdx + 1), 10) || 0;

    var container = findStateContainer(el, key);
    if (!container) return;

    // Clear any pending mouseleave timer
    var timers = hoverTimers.get(el) || {};
    if (timers.leave) { clearTimeout(timers.leave); timers.leave = null; }

    var apply = function() {
      container.setAttribute('data-state-' + key, 'true');
      persistState(container, key, 'true');
      container.dispatchEvent(new CustomEvent('htmx-r:state-change', {
        detail: { key: key, value: 'true', element: el },
        bubbles: true
      }));
    };

    if (delay > 0) {
      timers.enter = setTimeout(apply, delay);
      hoverTimers.set(el, timers);
    } else {
      apply();
    }
  }, true);

  document.addEventListener('mouseleave', function(e) {
    var el = e.target.closest('[hx-state-on-hover]');
    if (!el) return;

    var attr = el.getAttribute('hx-state-on-hover').trim();
    var colonIdx = attr.indexOf(':');
    var key = colonIdx === -1 ? attr : attr.slice(0, colonIdx).trim();

    var container = findStateContainer(el, key);
    if (!container) return;

    var timers = hoverTimers.get(el) || {};
    if (timers.enter) { clearTimeout(timers.enter); timers.enter = null; }

    // Small delay on leave to allow moving into tooltip content
    timers.leave = setTimeout(function() {
      container.setAttribute('data-state-' + key, 'false');
      persistState(container, key, 'false');
      container.dispatchEvent(new CustomEvent('htmx-r:state-change', {
        detail: { key: key, value: 'false', element: el },
        bubbles: true
      }));
    }, 100);
    hoverTimers.set(el, timers);
  }, true);

  // ── KEYBOARD NAVIGATION (v1.2) ──────────────────────────────────────

  /**
   * data-key-nav="{key}"  —  arrow key navigation through child items
   *
   * Tracks the active item index in a state key. Arrow Up/Down moves through
   * children marked with [data-key-nav-item]. Enter dispatches a click on
   * the active item. Home/End jump to first/last.
   *
   * Usage:
   *   <div data-state-active="0" hx-ext="reactive" data-key-nav="active">
   *     <div data-key-nav-item data-class-when="active:0:bg-blue-600" data-class-default="bg-transparent">Item 0</div>
   *     <div data-key-nav-item data-class-when="active:1:bg-blue-600" data-class-default="bg-transparent">Item 1</div>
   *     <div data-key-nav-item data-class-when="active:2:bg-blue-600" data-class-default="bg-transparent">Item 2</div>
   *   </div>
   *
   * Works with data-class-when for highlighting the active item.
   * The container must be focusable (tabindex="0") or contain a focused input.
   */
  document.addEventListener('keydown', function(e) {
    var nav = e.target.closest('[data-key-nav]');
    if (!nav) return;

    var validKeys = ['ArrowUp', 'ArrowDown', 'Enter', 'Home', 'End'];
    if (validKeys.indexOf(e.key) === -1) return;

    var key = nav.getAttribute('data-key-nav').trim();
    var items = nav.querySelectorAll('[data-key-nav-item]');
    if (items.length === 0) return;

    var current = parseInt(nav.getAttribute('data-state-' + key), 10) || 0;
    var next = current;

    switch (e.key) {
      case 'ArrowDown':
        next = (current + 1) % items.length;
        e.preventDefault();
        break;
      case 'ArrowUp':
        next = (current - 1 + items.length) % items.length;
        e.preventDefault();
        break;
      case 'Home':
        next = 0;
        e.preventDefault();
        break;
      case 'End':
        next = items.length - 1;
        e.preventDefault();
        break;
      case 'Enter':
        if (items[current]) {
          items[current].click();
        }
        e.preventDefault();
        return;
    }

    if (next !== current) {
      var value = String(next);
      nav.setAttribute('data-state-' + key, value);
      persistState(nav, key, value);
      syncToURL(nav, key, value);
      nav.dispatchEvent(new CustomEvent('htmx-r:state-change', {
        detail: { key: key, value: value, element: nav },
        bubbles: true
      }));

      // Scroll active item into view
      if (items[next] && items[next].scrollIntoView) {
        items[next].scrollIntoView({ block: 'nearest' });
      }
    }
  });

  // ── CSS TRANSITIONS (v1.2) ──────────────────────────────────────────

  /**
   * data-transition  —  animate data-when show/hide with CSS classes
   *
   * Instead of instant display:none/block, applies enter/leave transition
   * classes so elements can fade, slide, or scale in/out.
   *
   * Usage:
   *   <div data-when="menu:open"
   *        data-transition="fade"
   *        data-transition-duration="200">
   *     Animated content
   *   </div>
   *
   * Built-in transition presets:
   *   "fade"       — opacity 0→1 / 1→0
   *   "slide-down" — translateY(-8px)→0 + opacity
   *   "slide-up"   — translateY(8px)→0 + opacity
   *   "scale"      — scale(0.95)→1 + opacity
   *
   * Custom classes (advanced):
   *   data-transition-enter="opacity-0"
   *   data-transition-enter-active="transition-opacity duration-200"
   *   data-transition-enter-to="opacity-100"
   *   data-transition-leave="opacity-100"
   *   data-transition-leave-active="transition-opacity duration-200"
   *   data-transition-leave-to="opacity-0"
   */
  var transitionPresets = {
    'fade': {
      enter: 'htmxr-fade-enter',
      enterActive: 'htmxr-fade-enter-active',
      leave: 'htmxr-fade-leave',
      leaveActive: 'htmxr-fade-leave-active'
    },
    'slide-down': {
      enter: 'htmxr-slide-down-enter',
      enterActive: 'htmxr-slide-down-enter-active',
      leave: 'htmxr-slide-down-leave',
      leaveActive: 'htmxr-slide-down-leave-active'
    },
    'slide-up': {
      enter: 'htmxr-slide-up-enter',
      enterActive: 'htmxr-slide-up-enter-active',
      leave: 'htmxr-slide-up-leave',
      leaveActive: 'htmxr-slide-up-leave-active'
    },
    'scale': {
      enter: 'htmxr-scale-enter',
      enterActive: 'htmxr-scale-enter-active',
      leave: 'htmxr-scale-leave',
      leaveActive: 'htmxr-scale-leave-active'
    }
  };

  // Inject transition CSS once
  var transitionStyleId = 'htmxr-transition-styles';
  if (!document.getElementById(transitionStyleId)) {
    var style = document.createElement('style');
    style.id = transitionStyleId;
    style.textContent =
      /* fade */
      '.htmxr-fade-enter { opacity: 0; }' +
      '.htmxr-fade-enter-active { transition: opacity var(--htmxr-duration, 150ms) ease-out; opacity: 1; }' +
      '.htmxr-fade-leave { opacity: 1; }' +
      '.htmxr-fade-leave-active { transition: opacity var(--htmxr-duration, 150ms) ease-in; opacity: 0; }' +
      /* slide-down */
      '.htmxr-slide-down-enter { opacity: 0; transform: translateY(-8px); }' +
      '.htmxr-slide-down-enter-active { transition: opacity var(--htmxr-duration, 150ms) ease-out, transform var(--htmxr-duration, 150ms) ease-out; opacity: 1; transform: translateY(0); }' +
      '.htmxr-slide-down-leave { opacity: 1; transform: translateY(0); }' +
      '.htmxr-slide-down-leave-active { transition: opacity var(--htmxr-duration, 150ms) ease-in, transform var(--htmxr-duration, 150ms) ease-in; opacity: 0; transform: translateY(-8px); }' +
      /* slide-up */
      '.htmxr-slide-up-enter { opacity: 0; transform: translateY(8px); }' +
      '.htmxr-slide-up-enter-active { transition: opacity var(--htmxr-duration, 150ms) ease-out, transform var(--htmxr-duration, 150ms) ease-out; opacity: 1; transform: translateY(0); }' +
      '.htmxr-slide-up-leave { opacity: 1; transform: translateY(0); }' +
      '.htmxr-slide-up-leave-active { transition: opacity var(--htmxr-duration, 150ms) ease-in, transform var(--htmxr-duration, 150ms) ease-in; opacity: 0; transform: translateY(8px); }' +
      /* scale */
      '.htmxr-scale-enter { opacity: 0; transform: scale(0.95); }' +
      '.htmxr-scale-enter-active { transition: opacity var(--htmxr-duration, 150ms) ease-out, transform var(--htmxr-duration, 150ms) ease-out; opacity: 1; transform: scale(1); }' +
      '.htmxr-scale-leave { opacity: 1; transform: scale(1); }' +
      '.htmxr-scale-leave-active { transition: opacity var(--htmxr-duration, 150ms) ease-in, transform var(--htmxr-duration, 150ms) ease-in; opacity: 0; transform: scale(0.95); }';
    document.head.appendChild(style);
  }

  // Override the data-when handler to support transitions
  // We patch the state-change listener to intercept data-when elements that have data-transition
  document.addEventListener('htmx-r:state-change', function(e) {
    var key = e.detail.key;
    var value = e.detail.value;
    var container = e.target;

    var whenElements = container.querySelectorAll('[data-when^="' + key + ':"][data-transition]');
    whenElements.forEach(function(el) {
      var whenAttr = el.getAttribute('data-when');
      var whenValue = whenAttr.substring(key.length + 1);
      var preset = el.getAttribute('data-transition');
      var durationMs = parseInt(el.getAttribute('data-transition-duration'), 10) || 150;

      // Set CSS variable for duration
      el.style.setProperty('--htmxr-duration', durationMs + 'ms');

      var classes = transitionPresets[preset];
      if (!classes) return; // not a recognized preset, skip

      // Mark this element so the default data-when handler skips it
      el.setAttribute('data-htmxr-transitioning', 'true');

      if (whenValue === value) {
        // ENTER: show with transition
        el.style.display = '';
        el.removeAttribute('data-htmx-r-hidden');

        // Apply enter start state
        el.classList.add(classes.enter);
        el.classList.remove(classes.leaveActive, classes.leave);

        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            el.classList.remove(classes.enter);
            el.classList.add(classes.enterActive);
          });
        });

        // Clean up after transition
        setTimeout(function() {
          el.classList.remove(classes.enterActive);
          el.removeAttribute('data-htmxr-transitioning');
        }, durationMs + 20);

      } else if (el.style.display !== 'none' && !el.hasAttribute('data-htmx-r-hidden')) {
        // LEAVE: hide with transition (only if currently visible)
        el.classList.add(classes.leave);
        el.classList.remove(classes.enterActive, classes.enter);

        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            el.classList.remove(classes.leave);
            el.classList.add(classes.leaveActive);
          });
        });

        setTimeout(function() {
          el.style.display = 'none';
          el.setAttribute('data-htmx-r-hidden', 'true');
          el.classList.remove(classes.leaveActive);
          el.removeAttribute('data-htmxr-transitioning');
        }, durationMs + 20);
      }
    });
  });

  // ── INITIALIZATION ────────────────────────────────────────────────────

  // Find all state containers in a subtree (universal — no hardcoded names)
  function findStateContainersIn(root) {
    const containers = [];
    const elements = root.querySelectorAll ? root.querySelectorAll('*') : [];
    elements.forEach(el => {
      for (let i = 0; i < el.attributes.length; i++) {
        if (el.attributes[i].name.startsWith('data-state-')) {
          containers.push(el);
          break;
        }
      }
    });
    // Check root itself
    if (root.attributes) {
      for (let i = 0; i < root.attributes.length; i++) {
        if (root.attributes[i].name.startsWith('data-state-')) {
          containers.push(root);
          break;
        }
      }
    }
    return containers;
  }

  // Initialize state containers: restore persisted state and trigger sync
  function initStateContainers(containers) {
    containers.forEach(container => {
      // Restore from URL first (highest priority)
      restoreFromURL(container);

      // Then restore from localStorage
      restoreState(container);

      // Trigger initial state sync for all state attributes
      // This fires htmx-r:state-change for each key, which drives
      // data-when, data-state-text, data-class-when, and data-state-value
      Array.from(container.attributes).forEach(attr => {
        if (attr.name.startsWith('data-state-')) {
          const key = attr.name.replace('data-state-', '');
          const value = attr.value;

          container.dispatchEvent(new CustomEvent('htmx-r:state-change', {
            detail: { key, value, element: container },
            bubbles: true
          }));
        }
      });
    });
  }

  // Initialize state-dependent elements on page load
  document.addEventListener('DOMContentLoaded', function() {
    initStateContainers(findStateContainersIn(document));
  });

  // Re-initialize after HTMX swaps (new content may have state containers)
  document.addEventListener('htmx:afterSettle', function(e) {
    const target = e.detail.target || e.target;
    initStateContainers(findStateContainersIn(target));
  });

  // Helper: Get/set state programmatically
  window.htmxR = {
    getState: function(element, key) {
      const container = findStateContainer(element, key);
      return container ? container.getAttribute('data-state-' + key) : null;
    },

    setState: function(element, key, value) {
      const container = findStateContainer(element, key);
      if (container) {
        container.setAttribute('data-state-' + key, value);
        persistState(container, key, value);
        syncToURL(container, key, value);
        container.dispatchEvent(new CustomEvent('htmx-r:state-change', {
          detail: { key, value, element },
          bubbles: true
        }));
      }
    }
  };

  console.log('✓ HTMX-R (Reactive) v1.2 loaded — popover, hover, key-nav, transitions');
})();
