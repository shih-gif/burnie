// storage.js — handles all reading and writing to Chrome local storage

var Storage = {

  // Keys used in Chrome storage
  KEYS: {
    interactions: 'burnie_interactions',
    senderProfiles: 'burnie_sender_profiles',
    settings: 'burnie_settings'
  },

  // ============================================
  // SETTINGS
  // ============================================

  // Default user settings
  defaultSettings: {
    workStartHour: 9,   // 9am
    workEndHour: 19,    // 7pm
    workDays: [1, 2, 3, 4, 5], // Monday to Friday
    enabled: true
  },

  // Get user settings
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(this.KEYS.settings, (result) => {
        resolve(result[this.KEYS.settings] || this.defaultSettings);
      });
    });
  },

  // Save user settings
  async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        [this.KEYS.settings]: settings
      }, resolve);
    });
  },

  // ============================================
  // INTERACTIONS
  // ============================================

  // Save a new interaction when user acts on a nudge
  async saveInteraction(data) {
    const interactions = await this.getInteractions();

    const interaction = {
      id: Date.now(),
      senderId: data.senderId,
      timestamp: Date.now(),
      hour: data.hour,
      dayOfWeek: new Date().getDay(),
      isWeekend: data.isWeekend,
      violations: data.violations,
      userAction: data.userAction, // 'copied', 'dismissed', 'ignored'
      weekNumber: this.getWeekNumber()
    };

    interactions.push(interaction);

    // Keep only last 500 interactions to avoid storage bloat
    const trimmed = interactions.slice(-500);

    return new Promise((resolve) => {
      chrome.storage.local.set({
        [this.KEYS.interactions]: trimmed
      }, resolve);
    });
  },

  // Get all saved interactions
  async getInteractions() {
    return new Promise((resolve) => {
      chrome.storage.local.get(this.KEYS.interactions, (result) => {
        resolve(result[this.KEYS.interactions] || []);
      });
    });
  },

  // ============================================
  // SENDER PROFILES
  // ============================================

  // Get profile for a specific sender
  async getSenderProfile(senderId) {
    const profiles = await this.getAllProfiles();
    return profiles[senderId] || null;
  },

  // Get all sender profiles
  async getAllProfiles() {
    return new Promise((resolve) => {
      chrome.storage.local.get(this.KEYS.senderProfiles, (result) => {
        resolve(result[this.KEYS.senderProfiles] || {});
      });
    });
  },

  // Update sender profile after each interaction
  async updateSenderProfile(senderId, interactionData) {
    const profiles = await this.getAllProfiles();
    const existing = profiles[senderId] || {
      
      senderId,
      senderFirstName: '',
      senderName: '',
      totalContacts: 0,
      afterHoursCount: 0,
      weekendCount: 0,
      urgencyCount: 0,
      guiltCount: 0,
      overloadCount: 0,
      meetingCount: 0,
      userSaidYes: 0,    // times user copied a response (engaged)
      userSaidNo: 0,     // times user dismissed
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      senderFirstName: '',
      senderName: ''
    };

    // Update counts
    existing.totalContacts += 1;
    existing.lastSeen = Date.now();
    if (interactionData.senderFirstName) existing.senderFirstName = interactionData.senderFirstName;
if (interactionData.senderName) existing.senderName = interactionData.senderName;
if (interactionData.senderFirstName) existing.senderFirstName = interactionData.senderFirstName;
if (interactionData.senderName) existing.senderName = interactionData.senderName;

    // Count ALL violations in this interaction — not just primary
const v = interactionData.violations || [];
if (v.includes('after_hours')) existing.afterHoursCount = (existing.afterHoursCount || 0) + 1;
if (v.includes('weekend')) existing.weekendCount = (existing.weekendCount || 0) + 1;
if (v.includes('urgency')) existing.urgencyCount = (existing.urgencyCount || 0) + 1;
if (v.includes('guilt')) existing.guiltCount = (existing.guiltCount || 0) + 1;
if (v.includes('overload')) existing.overloadCount = (existing.overloadCount || 0) + 1;
if (v.includes('meeting_request')) existing.meetingCount = (existing.meetingCount || 0) + 1;

    // Track user response
    if (interactionData.userAction === 'copied') existing.userSaidYes += 1;
    if (interactionData.userAction === 'dismissed') existing.userSaidNo += 1;

    profiles[senderId] = existing;

    return new Promise((resolve) => {
      chrome.storage.local.set({
        [this.KEYS.senderProfiles]: profiles
      }, resolve);
    });
  },

  // ============================================
  // WEEKLY STATS
  // ============================================

  // Get stats for the current week
  async getWeeklyStats() {
    const interactions = await this.getInteractions();
    const currentWeek = this.getWeekNumber();

    const thisWeek = interactions.filter(i => i.weekNumber === currentWeek);

    return {
      totalViolations: thisWeek.length,
      responded: thisWeek.filter(i => i.userAction === 'copied').length,
      dismissed: thisWeek.filter(i => i.userAction === 'dismissed').length,
      afterHours: thisWeek.filter(i => i.violations.includes('after_hours')).length,
      weekend: thisWeek.filter(i => i.violations.includes('weekend')).length,
      urgency: thisWeek.filter(i => i.violations.includes('urgency')).length,
      guilt: thisWeek.filter(i => i.violations.includes('guilt')).length,
      overload: thisWeek.filter(i => i.violations.includes('overload')).length
    };
  },

  // ============================================
  // UTILITIES
  // ============================================

  // Get current week number of the year
  getWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 604800000;
    return Math.floor(diff / oneWeek);
  },

  // Clear all Burnie data — for settings panel "reset" button
  async clearAllData() {
    return new Promise((resolve) => {
      chrome.storage.local.remove([
        this.KEYS.interactions,
        this.KEYS.senderProfiles
      ], resolve);
    });
  }

};