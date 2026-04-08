/**
 * htmx-r Build Progress Extension
 * Drop-in progressive build loop for page generation UIs.
 * Integrates with the htmx-r state system.
 *
 * Usage:
 *   <div id="build-stage"
 *        hx-ext="build-progress"
 *        data-poll-url="/api/seo/status?slug=my-slug"
 *        data-topic="The History of Artificial Intelligence">
 *   </div>
 *
 *   HtmxRBuildProgress.start(el, { pollUrl, topic, onReady, onFailed })
 *   HtmxRBuildProgress.stop(el)
 *
 * State keys written via htmxR.setState:
 *   build-phase   — current phase index (0-N)
 *   build-msg     — current humorous status message
 *   build-fact    — current CS/AI educational fact
 *   build-status  — idle | running | ready | failed
 *
 * Events dispatched on the container element:
 *   htmx-r:build-phase-change  — { phase, message, fact }
 *   htmx-r:build-ready         — { redirect }
 *   htmx-r:build-failed        — { error }
 */

(function () {
  'use strict';

  const MESSAGES = [
    'Warming up the neural networks for {topic}\u2026',
    'Teaching robots about {topic}\u2026',
    'Consulting the knowledge graph on {topic}\u2026',
    'Summoning relevant embeddings for {topic}\u2026',
    'Cross-referencing 47 Wikipedia articles on {topic}\u2026',
    'Asking the LLM nicely about {topic}\u2026',
    'Defragging the semantic index for {topic}\u2026',
    'Negotiating with the token budget on {topic}\u2026',
    'Polishing the prose about {topic}\u2026',
    'Running final sanity checks on {topic}\u2026',
  ];

  const FACTS = [
    'The term "Artificial Intelligence" was coined by John McCarthy in 1956.',
    'A transformer model\'s attention heads each learn different linguistic relationships.',
    'The first chess program was written by Alan Turing in 1950 \u2014 before computers could run it.',
    'Backpropagation was popularized in 1986 \u2014 but discovered independently at least three times.',
    'GPT-3 has 175 billion parameters. Your brain has ~100 trillion synapses.',
    'The traveling salesman problem is NP-hard. There are more routes between 20 cities than atoms in the universe.',
    'Dijkstra\'s shortest-path algorithm was designed in 20 minutes, without pen or paper.',
    'PageRank, the algorithm behind early Google, is named after Larry Page, not web pages.',
    'The halting problem proves that no algorithm can determine if arbitrary programs will finish.',
    'Gradient descent was first used in machine learning by Cauchy in 1847 \u2014 for astronomy.',
  ];

  // Internal session state per element (WeakMap avoids memory leaks)
  const _sessions = new WeakMap();

  function _interpolate(str, topic) {
    return str.replace(/\{topic\}/g, topic || 'your content');
  }

  function _emit(el, name, detail) {
    el.dispatchEvent(new CustomEvent(name, { detail: detail, bubbles: true }));
  }

  function _tick(el, session) {
    if (!session.running) return;

    const phase   = session.phase % MESSAGES.length;
    const msgRaw  = MESSAGES[phase];
    const fact    = FACTS[phase % FACTS.length];
    const message = _interpolate(msgRaw, session.topic);

    // Drive htmx-r reactive state
    if (window.htmxR && typeof htmxR.setState === 'function') {
      htmxR.setState(el, 'build-phase',  String(phase));
      htmxR.setState(el, 'build-msg',    message);
      htmxR.setState(el, 'build-fact',   fact);
    }

    _emit(el, 'htmx-r:build-phase-change', { phase: phase, message: message, fact: fact });

    session.phase++;

    // Poll the server for completion status
    fetch(session.pollUrl)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!session.running) return;
        if (data.status === 'ready') {
          _finish(el, session, 'ready', data.redirect);
        } else if (data.status === 'failed') {
          _finish(el, session, 'failed', data.error || 'Build failed');
        } else {
          // Still building — schedule next tick after pollMs
          session.timer = setTimeout(function () { _tick(el, session); }, session.pollMs);
        }
      })
      .catch(function () {
        if (!session.running) return;
        // Network hiccup — retry on next interval
        session.timer = setTimeout(function () { _tick(el, session); }, session.pollMs);
      });
  }

  function _finish(el, session, outcome, payload) {
    session.running = false;
    clearTimeout(session.timer);

    if (window.htmxR && typeof htmxR.setState === 'function') {
      htmxR.setState(el, 'build-status', outcome);
    }

    if (outcome === 'ready') {
      _emit(el, 'htmx-r:build-ready', { redirect: payload });
      if (typeof session.onReady === 'function') session.onReady(payload);
    } else {
      _emit(el, 'htmx-r:build-failed', { error: payload });
      if (typeof session.onFailed === 'function') session.onFailed(payload);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  var HtmxRBuildProgress = {
    /**
     * Start the build progress loop on an element.
     *
     * @param {HTMLElement|string} el      - container element or CSS selector
     * @param {Object}             options
     * @param {string}   options.pollUrl           - endpoint returning { status, redirect?, error? }
     * @param {string}   [options.topic]            - topic name interpolated into status messages
     * @param {Function} [options.onReady]          - called with redirect URL when status === "ready"
     * @param {Function} [options.onFailed]         - called with error string when status === "failed"
     * @param {number}   [options.pollMs=3000]      - milliseconds between polls
     */
    start: function (el, options) {
      if (typeof el === 'string') el = document.querySelector(el);
      if (!el) { console.warn('HtmxRBuildProgress.start: element not found'); return; }

      // Tear down any prior session on this element
      this.stop(el);

      var opts    = options || {};
      var pollUrl = opts.pollUrl || el.getAttribute('data-poll-url');
      var topic   = opts.topic   || el.getAttribute('data-topic') || '';

      if (!pollUrl) { console.warn('HtmxRBuildProgress: pollUrl is required'); return; }

      var session = {
        running:  true,
        phase:    0,
        pollUrl:  pollUrl,
        topic:    topic,
        pollMs:   opts.pollMs   || 3000,
        onReady:  opts.onReady  || null,
        onFailed: opts.onFailed || null,
        timer:    null,
      };

      _sessions.set(el, session);

      if (window.htmxR && typeof htmxR.setState === 'function') {
        htmxR.setState(el, 'build-status', 'running');
        htmxR.setState(el, 'build-phase',  '0');
      }

      _tick(el, session);
    },

    /**
     * Stop polling and reset build-status to idle.
     * @param {HTMLElement|string} el
     */
    stop: function (el) {
      if (typeof el === 'string') el = document.querySelector(el);
      if (!el) return;
      var session = _sessions.get(el);
      if (!session) return;
      session.running = false;
      clearTimeout(session.timer);
      if (window.htmxR && typeof htmxR.setState === 'function') {
        htmxR.setState(el, 'build-status', 'idle');
      }
      _sessions.delete(el);
    },
  };

  // ---------------------------------------------------------------------------
  // htmx-r extension registration — hx-ext="build-progress" auto-wires elements
  // ---------------------------------------------------------------------------
  if (window.htmx && typeof htmx.defineExtension === 'function') {
    htmx.defineExtension('build-progress', {
      onEvent: function (name, evt) {
        if (name !== 'htmx:afterProcessNode') return;
        var el = evt.detail.elt;
        if (!el || !el.hasAttribute('data-poll-url')) return;
        HtmxRBuildProgress.start(el, {});
      },
    });
  }

  window.HtmxRBuildProgress = HtmxRBuildProgress;
})();
