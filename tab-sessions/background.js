// Initialize storage with empty sessions array if it doesn't exist
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['sessions'], (result) => {
    if (!result.sessions) {
      chrome.storage.local.set({ sessions: [] });
    }
  });
});

// Listen for messages from popup and management page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveSession') {
    saveSession(request.sessionName).then(() => sendResponse({ success: true }));
  } else if (request.action === 'loadSession') {
    loadSession(request.sessionId).then(() => sendResponse({ success: true }));
  } else if (request.action === 'deleteSession') {
    deleteSession(request.sessionId).then(() => sendResponse({ success: true }));
  } else if (request.action === 'getSessions') {
    getSessions().then(sessions => sendResponse({ sessions }));
  } else if (request.action === 'getSession') {
    getSession(request.sessionId).then(session => sendResponse({ session }));
  } else if (request.action === 'updateSessionTabs') {
    updateSessionTabs(request.sessionId, request.tabs).then(() => sendResponse({ success: true }));
  } else if (request.action === 'openTabManager') {
    openTabManager(request.sessionId);
    sendResponse({ success: true });
  }
  
  // Return true to indicate we want to send a response asynchronously
  return true;
});

async function saveSession(sessionName) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const sessionTabs = tabs.map(tab => ({
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl
  }));

  const newSession = {
    id: Date.now().toString(),
    name: sessionName,
    tabs: sessionTabs,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const { sessions = [] } = await chrome.storage.local.get('sessions');
  sessions.push(newSession);
  await chrome.storage.local.set({ sessions });
  return sessions;
}

async function loadSession(sessionId) {
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  const session = sessions.find(s => s.id === sessionId);
  
  if (session) {
    // Create a new window with all the tabs
    const window = await chrome.windows.create({
      url: session.tabs.map(tab => tab.url),
      focused: true
    });
    
    // Update the session with the new window ID
    session.windowId = window.id;
    session.lastOpened = new Date().toISOString();
    await chrome.storage.local.set({ sessions });
    
    return session;
  }
  return null;
}

async function deleteSession(sessionId) {
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  const updatedSessions = sessions.filter(session => session.id !== sessionId);
  await chrome.storage.local.set({ sessions: updatedSessions });
  return updatedSessions;
}

async function getSessions() {
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  return sessions.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
}

// Get a single session by ID
async function getSession(sessionId) {
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  return sessions.find(session => session.id === sessionId) || null;
}

// Update session with new tabs
async function updateSessionTabs(sessionId, tabs) {
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);
  
  if (sessionIndex !== -1) {
    sessions[sessionIndex] = {
      ...sessions[sessionIndex],
      tabs: tabs,
      updatedAt: new Date().toISOString()
    };
    
    await chrome.storage.local.set({ sessions });
    return sessions[sessionIndex];
  }
  
  return null;
}

// Open the tab management page for a session
function openTabManager(sessionId) {
  chrome.tabs.create({
    url: `manage.html?sessionId=${sessionId}`
  });
}
