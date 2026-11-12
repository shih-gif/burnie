// content.js — Burnie v3

var lastUrl = location.href;
var lastEmailId = null;
var isProcessing = false;
var currentAnalysis = null;
var emailStates = {}; // tracks state per email ID
var analysisCache = {}; // stores analysis per email ID

// ============================================
// HELPERS
// ============================================

function getBadgeTime() {
  const now = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const day = days[now.getDay()];
  const hours = now.getHours();
  const mins = now.getMinutes().toString().padStart(2,'0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  const h = hours % 12 || 12;
  return `${day} · opened ${h}:${mins} ${ampm}`;
}

function buildResponseButtons(responses) {
  return responses.map((response, index) => `
    <button class="burnie-response-btn" data-response="${encodeURIComponent(response)}">
      <span class="burnie-response-number">${index + 1}</span>
      <span class="burnie-response-text">${response}</span>
    </button>
  `).join('');
}

function wireResponseButtons(saveOnCopy) {
  document.querySelectorAll('.burnie-response-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const response = decodeURIComponent(btn.getAttribute('data-response'));
      navigator.clipboard.writeText(response).then(() => {
        if (saveOnCopy) {
          saveInteraction('copied');
          emailStates[lastEmailId] = 'actioned';
        }
        const copied = document.getElementById('burnie-copied');
        if (copied) {
          copied.style.display = 'block';
          setTimeout(() => { copied.style.display = 'none'; }, 2000);
        }
        console.log('BURNIE: Response copied');
      }).catch(err => console.log('BURNIE: Copy failed', err));
    });
  });
}

// ============================================
// SIDEBAR — NORMAL
// ============================================

function createSidebar(templateData, memoryContext) {
  const existing = document.getElementById('burnie-sidebar');
  if (existing) existing.remove();

  const { nudge, badge, responses } = templateData;

  const sidebar = document.createElement('div');
  sidebar.id = 'burnie-sidebar';
  sidebar.innerHTML = `
    <div id="burnie-header">
      <div id="burnie-header-left">
        <span id="burnie-logo">Burnie</span>
        <div id="burnie-badge">
          <div id="burnie-badge-type">${badge.replace(/^[^\w]*/, '')}</div>
          <div id="burnie-badge-time">${getBadgeTime()}</div>
        </div>
      </div>
      <button id="burnie-close">✕</button>
    </div>
    <div id="burnie-body">
      <p id="burnie-nudge">${nudge}</p>
      ${memoryContext ? `
        <div id="burnie-memory">
          <div id="burnie-memory-label">Pattern detected</div>
          <div id="burnie-memory-text">${memoryContext}</div>
        </div>
      ` : ''}
      <div id="burnie-responses-label">Choose a response</div>
      <div id="burnie-responses">
        ${buildResponseButtons(responses)}
      </div>
      <div id="burnie-copied" style="display:none;">Copied to clipboard</div>
      <div class="burnie-divider"></div>
      <button id="burnie-dismiss">I don't need help with this</button>
      <button id="burnie-notworking">I'm only reading, not working</button>
    </div>
  `;

  if (!document.getElementById('burnie-character')) {
    const character = document.createElement('div');
    character.id = 'burnie-character';
    character.innerHTML = `<div id="burnie-character-inner"><div id="burnie-character-face"></div></div>`;
    document.body.appendChild(character);
  }

  document.body.appendChild(sidebar);

  setTimeout(() => {
    const char = document.getElementById('burnie-character');
    if (char) char.classList.add('burnie-char-visible');
  }, 200);

  setTimeout(() => sidebar.classList.add('burnie-visible'), 50);

  document.getElementById('burnie-close').addEventListener('click', () => {
    saveInteraction('ignored');
    hideSidebar();
  });

  document.getElementById('burnie-dismiss').addEventListener('click', () => {
    saveInteraction('dismissed');
    emailStates[lastEmailId] = 'dismissed';
    hideSidebar();
  });

  document.getElementById('burnie-notworking').addEventListener('click', () => {
  saveInteraction('dismissed');
  emailStates[lastEmailId] = {
    state: 'not_working',
    date: new Date().toDateString() // store the day it was set
  };
  console.log('BURNIE: Not working — recorded as skipped');
  hideSidebar();
});

  wireResponseButtons(true);
}

// ============================================
// SIDEBAR — ALREADY HANDLED
// ============================================

function showAlreadyHandledSidebar() {
  const existing = document.getElementById('burnie-sidebar');
  if (existing) return;

  // Get analysis for current email from cache
  const analysis = analysisCache[lastEmailId] || currentAnalysis;
  if (!analysis) return;

  const responses = Templates.getTemplate(analysis.violations).responses;

  const sidebar = document.createElement('div');
  sidebar.id = 'burnie-sidebar';
  sidebar.innerHTML = `
    <div id="burnie-header">
      <div id="burnie-header-left">
        <span id="burnie-logo">Burnie</span>
        <div id="burnie-badge">
          <div id="burnie-badge-type">Already handled</div>
          <div id="burnie-badge-time">${getBadgeTime()}</div>
        </div>
      </div>
      <button id="burnie-close">✕</button>
    </div>
    <div id="burnie-body">
      <p id="burnie-nudge">You already responded to this one. Need something different?</p>
      <div id="burnie-responses-label">Choose another response</div>
      <div id="burnie-responses">
        ${buildResponseButtons(responses)}
      </div>
      <div id="burnie-copied" style="display:none;">Copied to clipboard</div>
      <div class="burnie-divider"></div>
      <button id="burnie-dismiss">Close</button>
    </div>
  `;

  document.body.appendChild(sidebar);
  setTimeout(() => sidebar.classList.add('burnie-visible'), 50);

  document.getElementById('burnie-close').addEventListener('click', hideSidebar);
  document.getElementById('burnie-dismiss').addEventListener('click', hideSidebar);

  // Don't save on copy here — already handled
  wireResponseButtons(false);
}

// ============================================
// HIDE SIDEBAR
// ============================================

function hideSidebar() {
  const sidebar = document.getElementById('burnie-sidebar');
  if (sidebar) {
    sidebar.classList.remove('burnie-visible');
    setTimeout(() => { if (sidebar) sidebar.remove(); }, 300);
  }
  const char = document.getElementById('burnie-character');
  if (char) {
    char.classList.remove('burnie-char-visible');
    setTimeout(() => { if (char) char.remove(); }, 400);
  }
}

// ============================================
// STORAGE HELPERS
// ============================================

async function saveInteraction(userAction) {
  if (!currentAnalysis) return;
  if (currentAnalysis.interactionSaved) return;

  const interactionData = {
    senderId: currentAnalysis.senderId,
    senderFirstName: currentAnalysis.senderFirstName || '',
    senderName: currentAnalysis.senderName || '',
    hour: currentAnalysis.hour,
    isWeekend: currentAnalysis.isWeekend,
    violations: currentAnalysis.violations, // full array — all violations recorded
    userAction
  };

  await Storage.saveInteraction(interactionData);
  await Storage.updateSenderProfile(currentAnalysis.senderId, interactionData);

  currentAnalysis.interactionSaved = true;
  console.log('BURNIE: Interaction saved —', userAction);
}

// ============================================
// EMAIL DETECTION
// ============================================

function getEmailIdFromUrl(url) {
  const pattern = /#(inbox|sent|drafts|spam|trash|all|search|label)\/([a-zA-Z0-9]+)/;
  const match = url.match(pattern);
  return match ? match[2] : null;
}

async function handleEmailOpen() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const emailId = lastEmailId; // use lastEmailId — already set by checkForNavigation

// Check existing state for this email
const existingState = emailStates[emailId];

// Handle not_working — reset if it's a new day
if (existingState && existingState.state === 'not_working') {
  if (existingState.date === new Date().toDateString()) {
    // Same day — stay silent
    console.log('BURNIE: Not working today — staying silent');
    isProcessing = false;
    return;
  }
  // New day — clear the state and fire normally
  delete emailStates[emailId];
}

// Handle dismissed — stay silent forever on this email
if (existingState === 'dismissed') {
  console.log('BURNIE: Already dismissed — staying silent');
  isProcessing = false;
  return;
}

// Handle actioned — show already handled sidebar
if (existingState === 'actioned') {
  console.log('BURNIE: Already actioned — showing handled sidebar');
  showAlreadyHandledSidebar();
  isProcessing = false;
  return;
}

    console.log('BURNIE: Analyzing email...');

    let analysis = null;
    const delays = [800, 1500, 2500, 4000, 6000];

    for (let i = 0; i < delays.length; i++) {
      await new Promise(resolve => setTimeout(resolve, delays[i]));
      analysis = Extractor.analyze();
      if (analysis) {
        console.log(`BURNIE: Email read on attempt ${i + 1}`);
        break;
      }
      console.log(`BURNIE: Attempt ${i + 1} failed, retrying...`);
    }

    if (!analysis) {
      console.log('BURNIE: Could not read email after 5 attempts');
      isProcessing = false;
      return;
    }

    console.log('BURNIE: Violations detected:', analysis.violations);

    if (analysis.violations.length === 0) {
      console.log('BURNIE: No violations — staying silent');
      isProcessing = false;
      return;
    }

    currentAnalysis = analysis;
    currentAnalysis.senderFirstName = analysis.senderFirstName || '';
    currentAnalysis.senderName = analysis.senderName || '';
    currentAnalysis.interactionSaved = false;
    analysisCache[lastEmailId] = currentAnalysis; // cache it

    const templateData = Templates.getTemplate(analysis.violations);
    const enriched = await Patterns.enrichNudge(templateData.nudge, analysis.senderId);

    console.log('BURNIE: Memory context:', enriched.memoryContext);
    console.log('BURNIE: Showing nudge for:', templateData.violationType);

    createSidebar(templateData, enriched.memoryContext);

  } catch (e) {
    console.log('BURNIE: Error handling email', e);
  }

  isProcessing = false;
}

function checkForNavigation() {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    const emailId = getEmailIdFromUrl(currentUrl);
    if (emailId && emailId !== lastEmailId) {
      lastEmailId = emailId;
      console.log('BURNIE: Email opened, ID:', emailId);
      handleEmailOpen();
    } else if (!emailId) {
      hideSidebar();
      lastEmailId = null;
      
    }
  }
}

// ============================================
// INIT
// ============================================

async function init() {
  console.log('BURNIE IS ALIVE — v3 with memory');
  const emailId = getEmailIdFromUrl(location.href);
  if (emailId) {
    lastEmailId = emailId;
    handleEmailOpen();
  }
  setInterval(checkForNavigation, 500);
  console.log('BURNIE: Watching for emails...');
}

init();