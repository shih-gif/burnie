// extractor.js — reads email from Gmail DOM and extracts clean metadata

var Extractor = {

  // Get the currently open email's data from Gmail's DOM
  getEmailData() {
    try {
      // Gmail renders email content in a div with role="main"
      const emailBody = document.querySelector('div[role="main"]');
      if (!emailBody) return null;

      // Get sender info
      const senderEl = emailBody.querySelector('span[email]');
      const senderEmail = senderEl ? senderEl.getAttribute('email') : 'unknown@unknown.com';
      const senderName = senderEl ? senderEl.getAttribute('name') || senderEl.innerText : 'Someone';

      // Get email body text
      const bodyEl = emailBody.querySelector('div[data-message-id] .a3s');
      const bodyText = bodyEl ? bodyEl.innerText : '';

      // Get subject
      const subjectEl = document.querySelector('h2.hP');
      const subject = subjectEl ? subjectEl.innerText : '';

      // Get timestamp
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay(); // 0 = Sunday, 6 = Saturday

      return {
        senderEmail,
        senderName,
        bodyText,
        subject,
        hour,
        day,
        isWeekend: day === 0 || day === 6
      };

    } catch (e) {
      console.log('BURNIE: Error reading email', e);
      return null;
    }
  },

  // Hash the sender email so we never store the real address
  hashSender(email) {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      const char = email.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).substring(0, 6);
  },

  // Strip sender name from body text before any processing
  anonymizeText(text, senderName) {
    if (!text || !senderName) return text;

    // Remove first and last name individually
    const nameParts = senderName.trim().split(' ');
    let clean = text;
    nameParts.forEach(part => {
      if (part.length > 2) { // avoid removing short words like "de" "la"
        const regex = new RegExp(part, 'gi');
        clean = clean.replace(regex, '[name]');
      }
    });

    return clean;
  },

  // Detect what type of boundary violation this email contains
  detectViolations(emailData) {
    const { bodyText, subject, hour, isWeekend } = emailData;
    const fullText = (bodyText + ' ' + subject).toLowerCase();
    const violations = [];

    // After hours — before 8am or after 7pm
    if (hour < 8 || hour >= 19) {
      violations.push('after_hours');
    }

    // Weekend request
    if (isWeekend) {
      violations.push('weekend');
    }

    // Urgency pressure keywords
    const urgencyKeywords = [
      'asap', 'urgent', 'urgently', 'immediately', 'right away',
      'as soon as possible', 'eod', 'end of day', 'by tonight',
      'need this now', 'critical', 'emergency', 'deadline today',
      'before you leave', 'before end of day'
    ];
    if (urgencyKeywords.some(k => fullText.includes(k))) {
      violations.push('urgency');
    }

    // Extra work / overload keywords
    const overloadKeywords = [
      'one more thing', 'also need', 'adding you to', 'can you also',
      'while you are at it', 'one last thing', 'quick extra',
      'just one more', 'another thing', 'on top of that'
    ];
    if (overloadKeywords.some(k => fullText.includes(k))) {
      violations.push('overload');
    }

    // Guilt / manipulation keywords
    const guiltKeywords = [
      'i know it\'s late', 'sorry to ask again', 'just this once',
      'i wouldn\'t ask if', 'i know you\'re busy but', 'hate to ask',
      'i know this is last minute', 'sorry for the short notice'
    ];
    if (guiltKeywords.some(k => fullText.includes(k))) {
      violations.push('guilt');
    }

    // Meeting request keywords
    const meetingKeywords = [
      'can you join', 'are you available', 'quick call', 'hop on a call',
      'jump on a call', 'can we meet', 'meeting request', 'schedule a call',
      'get on a call', 'video call', 'zoom call', 'teams call'
    ];
    if (meetingKeywords.some(k => fullText.includes(k))) {
      violations.push('meeting_request');
    }

    // Weekend work keywords (even if not actually weekend)
    const weekendKeywords = [
      'this weekend', 'saturday', 'sunday', 'over the weekend',
      'by monday morning', 'monday first thing'
    ];
    if (weekendKeywords.some(k => fullText.includes(k))) {
      if (!violations.includes('weekend')) violations.push('weekend');
    }

    return violations;
  },

  // Main function — call this to get everything you need
analyze() {
    const emailData = this.getEmailData();

    if (!emailData) return null;

    const violations = this.detectViolations(emailData);
    const senderId = this.hashSender(emailData.senderEmail);
    const cleanText = this.anonymizeText(emailData.bodyText, emailData.senderName);

    return {
      senderId,
      violations,
      cleanText,
      hour: emailData.hour,
      isWeekend: emailData.isWeekend,
      day: emailData.day,
      senderFirstName: emailData.senderName ? emailData.senderName.split(' ')[0] : '',
      senderName: emailData.senderName || ''
    };
  }

};