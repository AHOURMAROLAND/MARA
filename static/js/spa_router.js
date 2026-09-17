/**
 * MARA SPA Router
 * Provides fast, seamless Single Page Application navigation without hard page reloads.
 * Features:
 * - Link interception with smooth page transitions
 * - Dynamic form submission without full page refreshes
 * - Script execution in newly loaded pages
 * - History & Popstate synchronization
 * - Dynamic Bottom Navigation tab updates
 * - Lightweight top progress loading indicator
 */

(function() {
  'use strict';

  // State
  let isNavigating = false;
  const parser = new DOMParser();

  // Create Top Progress Bar
  const progressBar = document.createElement('div');
  progressBar.id = 'mara-spa-progress';
  progressBar.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0%;
    height: 3px;
    background: linear-gradient(90deg, #FF4565, #FF8038);
    z-index: 99999;
    transition: width 0.25s ease, opacity 0.25s ease;
    opacity: 0;
    pointer-events: none;
    box-shadow: 0 0 10px rgba(255, 69, 101, 0.7);
  `;
  document.documentElement.appendChild(progressBar);

  function startProgress() {
    progressBar.style.opacity = '1';
    progressBar.style.width = '30%';
    setTimeout(() => {
      if (progressBar.style.width === '30%') progressBar.style.width = '75%';
    }, 150);
  }

  function finishProgress() {
    progressBar.style.width = '100%';
    setTimeout(() => {
      progressBar.style.opacity = '0';
      setTimeout(() => {
        progressBar.style.width = '0%';
      }, 250);
    }, 150);
  }

  // Update active bottom nav tabs based on current path
  function updateBottomNav(urlPath) {
    const navTabs = document.querySelectorAll('.nav-tab-item');
    navTabs.forEach(tab => {
      tab.classList.remove('active');
      const href = tab.getAttribute('href');
      if (href) {
        if (urlPath === '/discussions/' && href.includes('discussions')) {
          tab.classList.add('active');
        } else if (urlPath.startsWith('/groups') && href.includes('groups')) {
          tab.classList.add('active');
        } else if (urlPath.startsWith('/story') && href.includes('story')) {
          tab.classList.add('active');
        } else if (urlPath.includes('settings') && href.includes('settings')) {
          tab.classList.add('active');
        }
      }
    });
  }

  // Execute scripts inside container
  function runScripts(container) {
    const scripts = container.querySelectorAll('script');
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
      newScript.appendChild(document.createTextNode(oldScript.innerHTML));
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }

  // Navigate to URL via AJAX
  async function navigate(url, pushState = true) {
    if (isNavigating) return;
    isNavigating = true;
    startProgress();

    try {
      const response = await fetch(url, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'text/html,application/xhtml+xml,application/xml'
        }
      });

      if (!response.ok) {
        // Fallback to regular navigation if server returns error
        window.location.href = url;
        return;
      }

      const htmlText = await response.text();
      const doc = parser.parseFromString(htmlText, 'text/html');

      // Update Title
      if (doc.title) {
        document.title = doc.title;
      }

      // Find content to swap
      const currentContent = document.getElementById('page-content') || document.body;
      const newContent = doc.getElementById('page-content') || doc.body;

      if (currentContent && newContent) {
        // Smooth fade out
        currentContent.style.opacity = '0.7';
        currentContent.style.transition = 'opacity 0.15s ease';

        setTimeout(() => {
          currentContent.innerHTML = newContent.innerHTML;
          currentContent.style.opacity = '1';

          // Re-run scripts
          runScripts(currentContent);

          // Update URL in history
          if (pushState) {
            window.history.pushState({ url: url }, doc.title || '', url);
          }

          // Update bottom nav
          updateBottomNav(window.location.pathname);

          // Scroll to top
          window.scrollTo(0, 0);

          // Dispatch custom event
          window.dispatchEvent(new CustomEvent('mara:page-loaded', { detail: { url } }));
          window.dispatchEvent(new Event('DOMContentLoaded'));

          finishProgress();
          isNavigating = false;
        }, 80);
      } else {
        window.location.href = url;
      }

    } catch (err) {
      console.warn('[MARA SPA Router] Navigation error:', err);
      window.location.href = url;
    } finally {
      setTimeout(() => { isNavigating = false; }, 300);
    }
  }

  // Intercept Link Clicks
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (!link) return;

    // Check if internal link
    const href = link.getAttribute('href');
    if (!href) return;

    // Skip external, anchors, downloads, new tabs, data-no-spa
    if (
      href.startsWith('#') ||
      href.startsWith('javascript:') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      link.hasAttribute('download') ||
      link.getAttribute('target') === '_blank' ||
      link.hasAttribute('data-no-spa') ||
      e.ctrlKey || e.metaKey || e.shiftKey
    ) {
      return;
    }

    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) {
      return;
    }

    // Skip media downloads or API paths
    if (url.pathname.startsWith('/media/') || url.pathname.startsWith('/static/') || url.pathname.startsWith('/download/')) {
      return;
    }

    e.preventDefault();
    navigate(url.href, true);
  });

  // Handle Back / Forward Browser History
  window.addEventListener('popstate', function(e) {
    navigate(window.location.href, false);
  });

  // Export helper globally
  window.MARA_SPA = {
    navigate: navigate,
    updateNav: updateBottomNav
  };

  // Initial tab update
  document.addEventListener('DOMContentLoaded', () => {
    updateBottomNav(window.location.pathname);
  });

})();
