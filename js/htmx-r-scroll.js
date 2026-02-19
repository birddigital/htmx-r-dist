/**
 * htmx-r Scroll Utilities
 * Precise scroll alignment for navigation and docs
 */

const HtmxRScroll = {
  /**
   * Initialize docs-style navigation with sidebar and scroll alignment
   */
  initDocsNav(options = {}) {
    const {
      sidebarSelector = 'aside a[href^="#"]',
      sectionSelector = 'section[id]',
      stickyOffset = 120,
      activeClass = 'active'
    } = options;

    const sections = document.querySelectorAll(sectionSelector);
    const navLinks = document.querySelectorAll(sidebarSelector);
    const navbar = document.querySelector('nav');

    const getNavbarHeight = () => navbar ? navbar.offsetHeight : 80;

    const setActiveLink = (sectionId) => {
      navLinks.forEach(link => link.classList.remove(activeClass));
      const activeLink = document.querySelector(`${sidebarSelector}[href="#${sectionId}"]`);
      if (activeLink) activeLink.classList.add(activeClass);
    };

    // Handle link clicks with precise alignment
    navLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);

        if (targetSection) {
          setActiveLink(targetId);
          const targetPosition = targetSection.getBoundingClientRect().top + 
                                  window.pageYOffset - stickyOffset;

          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      });
    });

    return { setActiveLink, getNavbarHeight };
  },

  /**
   * Scroll to element with offset
   */
  scrollTo(elementOrSelector, offset = 0, smooth = true) {
    const element = typeof elementOrSelector === 'string' 
      ? document.querySelector(elementOrSelector)
      : elementOrSelector;

    if (!element) return;

    const targetPosition = element.getBoundingClientRect().top + 
                          window.pageYOffset - offset;

    window.scrollTo({
      top: targetPosition,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }
};

// Global access
window.HtmxRScroll = HtmxRScroll;
