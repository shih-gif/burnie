// templates.js — pre-written nudges and responses for each violation type

var Templates = {

  // Priority order — most important violation shown first
  priority: ['guilt', 'urgency', 'after_hours', 'weekend', 'overload', 'meeting_request'],

  // Get the highest priority violation from the list
  getPrimaryViolation(violations) {
    if (!violations || violations.length === 0) return null;
    for (const type of this.priority) {
      if (violations.includes(type)) return type;
    }
    return violations[0];
  },

  // All nudge + response templates
  templates: {

    after_hours: {
      nudge: "This email arrived outside your working hours. You don't have to respond right now.",
      badge: "Off hours",
      responses: [
        "Thanks for reaching out. I'm offline for the evening and will pick this up tomorrow morning.",
        "I've seen your message. I work until 7pm and will respond first thing tomorrow.",
        "Thanks — I'll get back to you during working hours tomorrow."
      ]
    },

    urgency: {
      nudge: "This message uses urgency language. Take a breath — not every 'urgent' request actually is.",
      badge: "Rush request",
      responses: [
        "I understand this feels time-sensitive. I'm currently at capacity and will look at this tomorrow morning.",
        "Thanks for flagging this. I'll review and respond by end of tomorrow.",
        "I've received your message. I'll get to this as soon as I can — likely tomorrow."
      ]
    },

    weekend: {
      nudge: "This is a request that touches your weekend. Weekends are yours.",
      badge: "Weekend",
      responses: [
        "I don't work weekends. I'll pick this up first thing Monday morning.",
        "Thanks for reaching out. I'm offline on weekends and will respond Monday.",
        "I keep my weekends free. I'll get back to you bright and early Monday."
      ]
    },

    overload: {
      nudge: "Someone is adding more to your plate. You're allowed to push back.",
      badge: "Overload",
      responses: [
        "I'm currently at capacity with existing priorities. Can we revisit this in two weeks?",
        "My plate is full right now. I'd need to deprioritize something else to take this on — can we discuss?",
        "Thanks for thinking of me. I don't have bandwidth for this right now. Can this wait until next sprint?"
      ]
    },

    guilt: {
      nudge: "This message uses guilt or pressure tactics. You don't owe anyone a yes just because they asked nicely.",
      badge: "Guilt Tactic",
      responses: [
        "I appreciate you reaching out. Unfortunately I'm not able to help with this right now.",
        "Thanks for the context. I'm going to have to pass on this one.",
        "I understand the situation. I'm not in a position to take this on at the moment."
      ]
    },

    meeting_request: {
      nudge: "Someone wants a meeting. Every meeting is time you're not doing your actual work.",
      badge: "Meeting push",
      responses: [
        "I'm keeping my calendar light this week. Can we handle this async over email instead?",
        "I don't have availability for a call right now. Can you send over the details in writing?",
        "My schedule is full this week. I can find time next week — or we could resolve this by email."
      ]
    },


  },

  // Main function — returns the nudge and 3 response options
  getTemplate(violations) {
    const primary = this.getPrimaryViolation(violations);
    const template = primary ? this.templates[primary] : this.templates.default;

    return {
      violationType: primary || 'default',
      nudge: template.nudge,
      badge: template.badge || '💬 Message',
      responses: template.responses,
      allViolations: violations || []
    };
  }

};