document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const sessionNameInput = document.getElementById('sessionName');
  const saveSessionBtn = document.getElementById('saveSession');
  const sessionsContainer = document.getElementById('sessions');
  const modal = document.getElementById('tabModal');
  const closeBtn = document.querySelector('.close');
  const cancelBtn = document.getElementById('cancelTabChanges');
  const saveTabChangesBtn = document.getElementById('saveTabChanges');
  const addCurrentTabBtn = document.getElementById('addCurrentTab');
  const addAllTabsBtn = document.getElementById('addAllTabs');
  const tabList = document.getElementById('tabList');
  const modalSessionName = document.getElementById('modalSessionName');

  let currentSessionId = null;
  let currentTabs = [];

  // Load saved sessions when popup opens
  loadSessions();

  // Save current tabs as a new session
  saveSessionBtn.addEventListener('click', () => {
    const sessionName = sessionNameInput.value.trim();
    if (sessionName) {
      chrome.runtime.sendMessage({
        action: 'saveSession',
        sessionName: sessionName
      }, () => {
        sessionNameInput.value = ''; // Clear input
        loadSessions(); // Refresh the list
      });
    }
  });

  // Load all saved sessions
  function loadSessions() {
    chrome.runtime.sendMessage({ action: 'getSessions' }, (response) => {
      const sessions = response?.sessions || [];
      renderSessions(sessions);
    });
  }

  // Render sessions in the UI
  function renderSessions(sessions) {
    if (sessions.length === 0) {
      sessionsContainer.innerHTML = '<p class="no-sessions">No saved sessions yet.</p>';
      return;
    }

    sessionsContainer.innerHTML = sessions.map(session => `
      <div class="session-item">
        <div class="session-info">
          <h3>${session.name}</h3>
          <p>${session.tabs.length} tabs • ${new Date(session.createdAt).toLocaleDateString()}</p>
        </div>
        <div class="session-actions">
          <button class="btn-open" data-id="${session.id}">Open</button>
          <button class="btn-manage" data-id="${session.id}" data-name="${session.name}">Manage Tabs</button>
          <button class="btn-delete" data-id="${session.id}">Delete</button>
        </div>
      </div>
    `).join('');

    // Add event listeners to the buttons
    document.querySelectorAll('.btn-open').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sessionId = e.target.dataset.id;
        chrome.runtime.sendMessage({
          action: 'loadSession',
          sessionId: sessionId
        });
      });
    });

    document.querySelectorAll('.btn-manage').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sessionId = e.target.dataset.id;
        const sessionName = e.target.dataset.name;
        openTabManager(sessionId, sessionName);
      });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sessionId = e.target.dataset.id;
        if (confirm('Are you sure you want to delete this session?')) {
          chrome.runtime.sendMessage({
            action: 'deleteSession',
            sessionId: sessionId
          }, () => {
            loadSessions(); // Refresh the list
          });
        }
      });
    });
  }

  // Open tab management in a new tab
  function openTabManager(sessionId, sessionName) {
    chrome.runtime.sendMessage({
      action: 'openTabManager',
      sessionId: sessionId
    });
  }

  // Render the tab list in the modal
  function renderTabList() {
    tabList.innerHTML = currentTabs.map((tab, index) => `
      <li class="tab-item" data-index="${index}">
        <img src="${tab.favIconUrl || 'images/icon16.png'}" class="favicon" alt="">
        <input type="text" class="tab-title" value="${tab.title || 'Untitled'}" data-index="${index}">
        <span class="tab-url" title="${tab.url}">${new URL(tab.url).hostname}</span>
        <button class="delete-tab" data-index="${index}">×</button>
      </li>
    `).join('');

    // Add event listeners for tab title editing
    document.querySelectorAll('.tab-title').forEach(input => {
      input.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        currentTabs[index].title = e.target.value;
      });
    });

    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        currentTabs.splice(index, 1);
        renderTabList();
      });
    });
  }





  // Handle refresh message from management page
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'refreshPopup') {
      loadSessions();
    }
  });

  // Allow saving with Enter key in session name input
  sessionNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveSessionBtn.click();
    }
  });
});
