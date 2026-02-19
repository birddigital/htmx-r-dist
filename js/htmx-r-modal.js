/**
 * htmx-r Modal Management
 * Global modal functions with proper event handling
 */

const HtmxRModal = {
  openModals: new Set(),
  eventListeners: {},

  /**
   * Open a modal by ID
   */
  open(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      console.warn(`Modal "${modalId}" not found`);
      return;
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    this.openModals.add(modalId);

    // Setup event listeners if not already set
    if (!this.eventListeners[modalId]) {
      this.setupEventListeners(modalId, options);
    }

    // Callback
    if (options.onOpen) options.onOpen(modal);
  },

  /**
   * Close a modal by ID
   */
  close(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.style.display = 'none';
    this.openModals.delete(modalId);

    // Restore body scroll if no modals open
    if (this.openModals.size === 0) {
      document.body.style.overflow = 'auto';
    }

    // Callback
    if (options.onClose) options.onClose(modal);
  },

  /**
   * Setup event listeners for modal
   */
  setupEventListeners(modalId, options = {}) {
    const {
      closeOnEscape = true,
      closeOnBackdrop = true
    } = options;

    const modal = document.getElementById(modalId);
    if (!modal) return;

    const modalContent = modal.querySelector('.modal-content');

    // Escape key listener
    if (closeOnEscape) {
      const escapeHandler = (e) => {
        if (e.key === 'Escape' && this.openModals.has(modalId)) {
          this.close(modalId);
        }
      };
      document.addEventListener('keydown', escapeHandler);
      this.eventListeners[modalId] = { escapeHandler };
    }

    // Backdrop click listener
    if (closeOnBackdrop && modalContent) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.close(modalId);
        }
      });

      modalContent.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
  },

  /**
   * Close all open modals
   */
  closeAll() {
    Array.from(this.openModals).forEach(modalId => {
      this.close(modalId);
    });
  }
};

// Global functions for backward compatibility
window.openModal = (modalId, options) => HtmxRModal.open(modalId, options);
window.closeModal = (modalId, options) => HtmxRModal.close(modalId, options);
window.HtmxRModal = HtmxRModal;
