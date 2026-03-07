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

  console.log('✓ HTMX-R (Reactive) v1.1 loaded — input binding, state-text, class-when');
})();
