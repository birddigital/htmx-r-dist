/**
 * htmx-r Intersection Observer Utility
 * Smart section detection that prevents interference during scrolling
 */

const HtmxRObserver = {
  /**
   * Create intersection observer for section highlighting
   */
  createSectionObserver(options = {}) {
    const {
      sections,
      navLinks,
      offset = 120,
      onSectionChange,
      disableDuringScroll = true
    } = options;

    let isScrolling = false;
    let scrollTimeout;

    const observerOptions = {
      root: null,
      rootMargin: `-${offset}px 0px -66% 0px`,
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      if (disableDuringScroll && isScrolling) return;

      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          if (onSectionChange) onSectionChange(id);
        }
      });
    }, observerOptions);

    // Observe all sections
    sections.forEach(section => observer.observe(section));

    // Control scrolling state
    const setScrolling = (state, duration = 1000) => {
      isScrolling = state;
      clearTimeout(scrollTimeout);
      if (state) {
        scrollTimeout = setTimeout(() => {
          isScrolling = false;
        }, duration);
      }
    };

    return { observer, setScrolling };
  },

  /**
   * Initialize docs-style observer with auto-highlighting
   */
  initDocsObserver(options = {}) {
    const {
      sectionSelector = 'section[id]',
      sidebarSelector = 'aside a[href^="#"]',
      offset = 120,
      activeClass = 'active'
    } = options;

    const sections = document.querySelectorAll(sectionSelector);
    const navLinks = document.querySelectorAll(sidebarSelector);

    const onSectionChange = (sectionId) => {
      navLinks.forEach(link => link.classList.remove(activeClass));
      const activeLink = document.querySelector(`${sidebarSelector}[href="#${sectionId}"]`);
      if (activeLink) activeLink.classList.add(activeClass);
    };

    return this.createSectionObserver({
      sections,
      navLinks,
      offset,
      onSectionChange
    });
  }
};

// Global access
window.HtmxRObserver = HtmxRObserver;
