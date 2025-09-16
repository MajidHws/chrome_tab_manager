document.addEventListener('DOMContentLoaded', async () => {
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('sessionId');
  
  if (!sessionId) {
    console.error('No session ID provided');
    showError('Error: No session ID provided');
    return;
  }

  // DOM Elements
  const sessionNameEl = document.getElementById('sessionName');
  const tabList = document.getElementById('tabList');
  const saveButton = document.getElementById('saveButton');
  const cancelButton = document.getElementById('cancelButton');
  const addCurrentTabBtn = document.getElementById('addCurrentTab');
  const addAllTabsBtn = document.getElementById('addAllTabs');

  let session = null;
  let tabs = [];
  let isLoading = false;

  // Show loading state
  function setLoading(loading) {
    isLoading = loading;
    document.body.classList.toggle('loading', loading);
    [saveButton, cancelButton, addCurrentTabBtn, addAllTabsBtn].forEach(btn => {
      if (btn) btn.disabled = loading;
    });
  }

  // Show error message
  function showError(message) {
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.textContent = message;
    document.body.prepend(errorEl);
    setTimeout(() => errorEl.remove(), 5000);
  }

  // Load session data
  async function loadSession() {
    try {
      setLoading(true);
      const response = await chrome.runtime.sendMessage({
        action: 'getSession',
        sessionId: sessionId
      });
      
      if (response && response.session) {
        session = response.session;
        tabs = [...(session.tabs || [])];
        sessionNameEl.textContent = session.name || 'Unnamed Session';
        renderTabs();
      } else {
        throw new Error('Session not found');
      }
    } catch (error) {
      console.error('Error loading session:', error);
      showError('Failed to load session. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Render tabs in the list
  function renderTabs() {
    if (tabs.length === 0) {
      tabList.innerHTML = `
        <li class="empty-state">
          <p>No tabs in this session yet.</p>
          <p class="hint">Use the buttons above to add tabs.</p>
        </li>
      `;
      return;
    }

    tabList.innerHTML = tabs.map((tab, index) => {
      let faviconUrl = tab.favIconUrl;
      if (!faviconUrl && tab.url) {
        try {
          const url = new URL(tab.url);
          faviconUrl = `${url.protocol}//${url.host}/favicon.ico`;
        } catch (e) {
          // Invalid URL, use default favicon
        }
      }

      return `
        <li class="tab-item" data-index="${index}" draggable="true">
          <img src="${faviconUrl || 'images/icon16.png'}" class="tab-favicon" alt="" onerror="this.style.display='none';">
          <span class="tab-title" title="${escapeHtml(tab.title || 'Untitled')}">
            ${escapeHtml(tab.title || 'Untitled Tab')}
          </span>
          <span class="tab-url" title="${escapeHtml(tab.url || '')}">
            ${tab.url ? new URL(tab.url).hostname : 'No URL'}
          </span>
          <button class="delete-tab" data-index="${index}" title="Remove tab">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </li>
      `;
    }).join('');

    // Add drag and drop functionality
    setupDragAndDrop();
  }

  // Helper to escape HTML
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Set up drag and drop for reordering tabs
  function setupDragAndDrop() {
    let draggedItem = null;

    document.querySelectorAll('.tab-item').forEach(item => {
      // Drag start
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        setTimeout(() => item.classList.add('dragging'), 0);
      });

      // Drag end
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedItem = null;
      });

      // Drag over
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(tabList, e.clientY);
        const currentItem = document.querySelector('.dragging');
        
        if (afterElement == null) {
          tabList.appendChild(currentItem);
        } else {
          tabList.insertBefore(currentItem, afterElement);
        }
      });
    });

    // Update tabs order after drop
    tabList.addEventListener('dragend', () => {
      const newTabs = [];
      document.querySelectorAll('.tab-item').forEach((item, index) => {
        const tabIndex = parseInt(item.dataset.index);
        newTabs.push(tabs[tabIndex]);
      });
      tabs = newTabs;
      
      // Update data-index attributes
      document.querySelectorAll('.tab-item').forEach((item, index) => {
        item.dataset.index = index;
      });
    });
  }

  // Helper for drag and drop positioning
  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.tab-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      
      if (offset < 0 && offset > -box.height) {
        return { element: child, offset: offset };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // Add current tab to the session
  addCurrentTabBtn.addEventListener('click', async () => {
    try {
      setLoading(true);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.url) {
        // Check if tab already exists
        if (!tabs.some(t => t.url === tab.url)) {
          tabs.push({
            url: tab.url,
            title: tab.title || 'New Tab',
            favIconUrl: tab.favIconUrl
          });
          renderTabs();
        }
      }
    } catch (error) {
      console.error('Error adding current tab:', error);
      showError('Failed to add current tab. Please try again.');
    } finally {
      setLoading(false);
    }
  });

  // Add all tabs from current window to the session
  addAllTabsBtn.addEventListener('click', async () => {
    try {
      setLoading(true);
      const currentTabs = await chrome.tabs.query({ currentWindow: true });
      const existingUrls = new Set(tabs.map(t => t.url));
      let added = false;

      for (const tab of currentTabs) {
        if (tab.url && !existingUrls.has(tab.url)) {
          tabs.push({
            url: tab.url,
            title: tab.title || 'New Tab',
            favIconUrl: tab.favIconUrl
          });
          added = true;
        }
      }

      if (added) {
        renderTabs();
      } else {
        showError('No new tabs to add');
      }
    } catch (error) {
      console.error('Error adding all tabs:', error);
      showError('Failed to add tabs. Please try again.');
    } finally {
      setLoading(false);
    }
  });

  // Handle tab deletion
  tabList.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-tab');
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      
      const index = parseInt(deleteBtn.dataset.index);
      if (!isNaN(index) && index >= 0 && index < tabs.length) {
        tabs.splice(index, 1);
        renderTabs();
      }
    }
  });

  // Save changes
  async function saveChanges() {
    try {
      setLoading(true);
      await chrome.runtime.sendMessage({
        action: 'updateSessionTabs',
        sessionId: sessionId,
        tabs: tabs
      });
      
      // Notify the popup to refresh
      chrome.runtime.sendMessage({ action: 'refreshPopup' });
      window.close();
    } catch (error) {
      console.error('Error saving changes:', error);
      showError('Failed to save changes. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Event Listeners
  saveButton.addEventListener('click', saveChanges);
  
  cancelButton.addEventListener('click', () => {
    if (confirm('Discard all changes?')) {
      window.close();
    }
  });

  // Handle keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (confirm('Discard all changes and close?')) {
        window.close();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveChanges();
    }
  });

  // Initialize
  loadSession();
});
