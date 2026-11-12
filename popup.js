const VIOLATION_LABELS = {
  after_hours: 'Off hours',
  weekend: 'Weekend',
  urgency: 'Rush request',
  guilt: 'Guilt tactic',
  overload: 'Overload',
  meeting_request: 'Meeting push'
};

window.toggleDrawer = function(drawerId, caretId) {
  const d = document.getElementById(drawerId);
  const c = document.getElementById(caretId);
  if (!d || !c) return;
  const open = d.classList.contains('open');
  d.classList.toggle('open', !open);
  c.classList.toggle('open', !open);
};

async function loadStats() {
  try {
    const weekly = await Patterns.getWeeklySummary();
    document.getElementById('popup-loading').style.display = 'none';
    document.getElementById('popup-content').style.display = 'block';

    if (!weekly.hasData) {
      document.getElementById('empty-state').style.display = 'block';
      return;
    }

    document.getElementById('stat-total').textContent = weekly.totalViolations;
    document.getElementById('stat-responded').textContent = weekly.responded;
    document.getElementById('stat-dismissed').textContent = weekly.dismissed;

    if (weekly.topViolationType) {
      const interactions = await Storage.getInteractions();
      const currentWeek = Storage.getWeekNumber();
      const thisWeek = interactions.filter(i => i.weekNumber === currentWeek);

      const normalizedTop = weekly.topViolationType.toLowerCase().replace(/\s+/g, '_');
      const topCount = thisWeek.filter(i =>
        i.violations && i.violations.some(v =>
          v.toLowerCase().replace(/\s+/g, '_') === normalizedTop
        )
      ).length;
      const label = VIOLATION_LABELS[normalizedTop] || weekly.topViolationType;

      const section = document.getElementById('most-common-section');
      const block = document.getElementById('most-common-block');
      document.getElementById('most-common-type').textContent = label;
      document.getElementById('most-common-count').textContent = `${topCount} of ${weekly.totalViolations}`;
      block.style.borderLeftColor = '#E8A87C';
      section.style.display = 'block';
    }

    await loadTopSender();

  } catch (e) {
    console.log('Burnie popup error:', e);
    document.getElementById('popup-loading').textContent = 'Error loading stats.';
  }
}

async function loadTopSender() {
  try {
    const interactions = await Storage.getInteractions();
    const currentWeek = Storage.getWeekNumber();
    const thisWeek = interactions.filter(i => i.weekNumber === currentWeek);
    if (thisWeek.length === 0) return;

    const senderCounts = {};
    thisWeek.forEach(i => {
      senderCounts[i.senderId] = (senderCounts[i.senderId] || 0) + 1;
    });

    const sorted = Object.entries(senderCounts).sort((a, b) => b[1] - a[1]);
    if (!sorted.length || sorted[0][1] < 2) return;

    const topId = sorted[0][0];
    const count = sorted[0][1];
    const profile = await Storage.getSenderProfile(topId);
    if (!profile) return;

    const firstName = profile.senderFirstName || 'This sender';
    const displayName = profile.senderName || `Sender ${topId.substring(0,6).toUpperCase()}`;

    document.getElementById('sender-card').style.display = 'block';
    document.getElementById('sender-name').textContent = displayName;
    document.getElementById('sender-contacts').textContent = `${count} contact${count > 1 ? 's' : ''} this week`;

    const violations = {
      'Off hours': (profile.afterHoursCount || 0) + (profile.weekendCount || 0),
      'Rush request': profile.urgencyCount || 0,
      'Guilt tactic': profile.guiltCount || 0,
      'Overload': profile.overloadCount || 0
    };

    const total = Object.values(violations).reduce((a, b) => a + b, 0);
    const barsEl = document.getElementById('sender-bars');
    barsEl.innerHTML = '';

    Object.entries(violations)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .forEach(([label, val]) => {
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        barsEl.innerHTML += `
          <div class="bar-wrap">
            <div class="bar-row">
              <span class="bar-label">${label}</span>
              <span class="bar-pct">${pct}%</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${pct}%"></div>
            </div>
          </div>
        `;
      });

    const totalContacts = profile.totalContacts || 1;
    const heldPct = Math.round(((profile.userSaidNo || 0) / totalContacts) * 100);

    if (totalContacts >= 3) {
      document.getElementById('boundary-held-section').style.display = 'block';
      document.getElementById('boundary-held-num').textContent = `${heldPct}%`;
      document.getElementById('boundary-held-sub').textContent = `with ${firstName}`;
    }

  } catch (e) {
    console.log('Burnie: sender load error', e);
  }
}

document.getElementById('btn-clear').addEventListener('click', async () => {
  const confirmed = confirm('This will permanently delete all your Burnie data. Are you sure?');
  if (confirmed) {
    await Storage.clearAllData();
    location.reload();
  }
});

document.getElementById('week-btn').addEventListener('click', () => window.toggleDrawer('wd','wc'));
document.getElementById('sender-btn').addEventListener('click', () => window.toggleDrawer('sd','sc'));

loadStats();