/**
 * ScrollManager - Enhances the UI with scrollable containers
 * Automatically applies to all menu lists and handles window resizing
 */
const ScrollManager = (function() {
    // Elements that need scrolling functionality
    const scrollableElementIds = [
      'leaderboard',
      'tournament-players',
      'waiting-players-list',
      'tournament-list',
      'upcoming-matches',
      'completed-matches'
    ];
    
    // Card elements that need their content to be scrollable
    const cardSelectors = [
      '.card-body:has(#leaderboard)',
      '.card-body:has(#tournament-players)',
      '.card-body:has(#waiting-players-list)',
      '.card-body:has(#tournament-list)',
      '.card-body:has(#upcoming-matches)',
      '.card-body:has(#completed-matches)'
    ];
    
    /**
     * Initialize the scroll manager
     */
    function init() {
      console.log("ScrollManager: Initializing");
      
      // First add our CSS if it doesn't exist yet
      addScrollStyles();
      
      // Apply scrolling classes to all relevant elements
      applyScrollClasses();
      
      // Handle window resize events
      window.addEventListener('resize', debounce(handleResize, 200));
      
      // Initialize based on current window size
      handleResize();
      
      console.log("ScrollManager: Initialization complete");
    }
    
    /**
     * Add scroll-specific CSS to the document
     */
    function addScrollStyles() {
      // Check if our stylesheet already exists
      if (document.getElementById('scroll-manager-styles')) {
        return;
      }
      
      const style = document.createElement('style');
      style.id = 'scroll-manager-styles';
      style.textContent = `
        /* Add any additional dynamic styles here */
        .card {
          display: flex;
          flex-direction: column;
        }
        
        .card-body {
          flex: 1 1 auto;
          overflow: hidden;
        }
      `;
      
      document.head.appendChild(style);
    }
    
    /**
     * Apply scrollable classes to elements
     */
    function applyScrollClasses() {
      // Apply to specific element IDs
      scrollableElementIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
          element.classList.add('scrollable-container');
        }
      });
      
      // Apply to card bodies that contain lists
      cardSelectors.forEach(selector => {
        try {
          // Use newer approach if supported
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            el.classList.add('scrollable');
          });
        } catch (e) {
          // Fallback for browsers that don't support :has()
          console.warn("Browser doesn't support :has() selector, using alternative approach");
          applyScrollableToCardBodiesAlternative();
        }
      });
    }
    
    /**
     * Alternative approach for browsers that don't support :has()
     */
    function applyScrollableToCardBodiesAlternative() {
      // Find all card bodies
      const cardBodies = document.querySelectorAll('.card-body');
      
      // Check each one for our target elements
      cardBodies.forEach(cardBody => {
        scrollableElementIds.forEach(id => {
          if (cardBody.querySelector(`#${id}`)) {
            cardBody.classList.add('scrollable');
          }
        });
      });
    }
    
    /**
     * Handle window resize events to adjust max heights
     */
    function handleResize() {
      const windowHeight = window.innerHeight;
      
      // Clear any existing dynamic classes
      clearDynamicHeightClasses();
      
      // Apply appropriate max-height class based on window height
      let heightClass;
      if (windowHeight < 600) {
        heightClass = 'max-height-sm';
      } else if (windowHeight < 900) {
        heightClass = 'max-height-md';
      } else {
        heightClass = 'max-height-lg';
      }
      
      // Apply the height class to all scrollable containers
      document.querySelectorAll('.scrollable-container').forEach(container => {
        container.classList.add(heightClass);
      });
    }
    
    /**
     * Clear dynamic height classes
     */
    function clearDynamicHeightClasses() {
      document.querySelectorAll('.scrollable-container').forEach(container => {
        container.classList.remove('max-height-sm', 'max-height-md', 'max-height-lg');
      });
    }
    
    /**
     * Apply scrolling to dynamically added elements
     * @param {HTMLElement} parentElement - Element to check for scrollable content
     */
    function refreshScrollableElements(parentElement = document) {
      applyScrollClasses();
      handleResize();
    }
    
    /**
     * Simple debounce implementation
     */
    function debounce(func, wait) {
      let timeout;
      return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
      };
    }
    
    // Public API
    return {
      init,
      refreshScrollableElements
    };
  })();
  
  // Initialize the ScrollManager when DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    ScrollManager.init();
  });
  
  // Make available globally
  window.ScrollManager = ScrollManager;