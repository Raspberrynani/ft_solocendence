/**
 * Mobile Viewport and Scroll Fixes
 * Ensures proper sizing and scrolling for mobile devices
 */
(function() {
    // Fix for iOS Safari viewport height issues
    function fixViewportHeight() {
        // First, get the visible viewport height
        let vh = window.innerHeight * 0.01;
        
        // Set the value in CSS as a custom property
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        
        // Apply the custom height to elements that need full viewport height
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => {
            page.style.maxHeight = `calc(100 * var(--vh))`;
        });
    }
    
    // Adjust page content on very small screens
    function adjustForSmallScreens() {
        const isTinyScreen = window.innerHeight < 500;
        document.body.classList.toggle('tiny-screen', isTinyScreen);
        
        // If screen is very small, ensure scrollability
        if (isTinyScreen) {
            const activePages = document.querySelectorAll('.page.active');
            activePages.forEach(page => {
                page.style.overflowY = 'auto';
                
                // Check if content is taller than viewport
                if (page.scrollHeight > window.innerHeight) {
                    // Add indicator that content is scrollable
                    if (!page.querySelector('.scroll-indicator')) {
                        const indicator = document.createElement('div');
                        indicator.className = 'scroll-indicator';
                        indicator.innerHTML = '<i class="fas fa-chevron-down"></i>';
                        indicator.style.cssText = `
                            position: fixed;
                            bottom: 10px;
                            left: 50%;
                            transform: translateX(-50%);
                            color: rgba(255, 255, 255, 0.7);
                            animation: bounce 1s infinite;
                            z-index: 1000;
                        `;
                        page.appendChild(indicator);
                        
                        // Remove indicator when user scrolls
                        const removeOnScroll = () => {
                            if (indicator.parentNode) {
                                indicator.parentNode.removeChild(indicator);
                            }
                            page.removeEventListener('scroll', removeOnScroll);
                        };
                        page.addEventListener('scroll', removeOnScroll);
                    }
                }
            });
        }
    }
    
    // Ensure menus fit within viewport
    function ensureMenusFitViewport() {
        // Get all active menus and dialogs
        const activeElements = document.querySelectorAll('.page.active, .modal-content, .card-body, .privacy-content');
        
        // Check each element
        activeElements.forEach(element => {
            // If element is taller than viewport, make it scrollable
            if (element.scrollHeight > window.innerHeight * 0.9) {
                element.style.maxHeight = `${window.innerHeight * 0.9}px`;
                element.style.overflowY = 'auto';
            }
        });
    }
    
    // Adjust layout after page transitions
    function adjustAfterPageChange() {
        setTimeout(() => {
            ensureMenusFitViewport();
            adjustForSmallScreens();
        }, 100); // Small delay to allow DOM to update
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        // Initial fixes
        fixViewportHeight();
        adjustForSmallScreens();
        ensureMenusFitViewport();
        
        // Listen for window resize events
        window.addEventListener('resize', Utils.debounce(() => {
            fixViewportHeight();
            adjustForSmallScreens();
            ensureMenusFitViewport();
        }, 250));
        
        // Apply after orientation change, with additional delay
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                fixViewportHeight();
                adjustForSmallScreens();
                ensureMenusFitViewport();
            }, 300); // Longer delay after orientation change
        });
        
        // Hook into page navigation if UIManager is available
        if (window.UIManager) {
            // Store the original function
            const originalNavigateTo = UIManager.navigateTo;
            
            // Override with our extended version
            UIManager.navigateTo = function(pageId) {
                // Call the original function
                originalNavigateTo.call(this, pageId);
                
                // Apply our adjustments after page change
                adjustAfterPageChange();
            };
            
            console.log("Extended UIManager.navigateTo with mobile adjustments");
        }
        
        // Add to App.init if available
        if (window.App && App.init) {
            const originalInit = App.init;
            
            App.init = async function() {
                // Call original init
                await originalInit.call(this);
                
                // Apply mobile fixes after init
                fixViewportHeight();
                adjustForSmallScreens();
                ensureMenusFitViewport();
                
                console.log("Applied mobile viewport fixes after App initialization");
            };
        }
        
        console.log("Mobile viewport and scroll fixes initialized");
    });
})();