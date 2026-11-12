// patterns.js — reads stored data and generates pattern insights

var Patterns = {

  // ============================================
  // SENDER ANALYSIS
  // ============================================

  async analyzeSender(senderId) {
    const profile = await Storage.getSenderProfile(senderId);

    if (!profile || profile.totalContacts === 0) {
      return {
        isKnown: false,
        isRepeatOffender: false,
        insight: null,
        complianceRate: null
      };
    }

    const totalContacts = profile.totalContacts;
    const complianceRate = totalContacts > 0
      ? Math.round((profile.userSaidYes / totalContacts) * 100)
      : 0;

    const isRepeatOffender = totalContacts >= 3;
    const insight = this.buildSenderInsight(profile, complianceRate);

    return {
      isKnown: true,
      isRepeatOffender,
      totalContacts,
      complianceRate,
      profile,
      insight
    };
  },

  buildSenderInsight(profile, complianceRate) {
    const { totalContacts, afterHoursCount, urgencyCount,
            guiltCount, weekendCount, userSaidYes } = profile;

    const violationCounts = {
      'off hours': afterHoursCount,
      'rush requests': urgencyCount,
      'guilt tactics': guiltCount,
      'weekend requests': weekendCount
    };

    const topViolation = Object.entries(violationCounts)
      .sort((a, b) => b[1] - a[1])
      .filter(([, count]) => count > 0)[0];

    let insight = '';

    if (totalContacts === 1) {
      insight = 'First time this person has triggered Burnie.';
    } else if (totalContacts < 5) {
      insight = `This person has triggered Burnie ${totalContacts} times.`;
    } else {
      insight = `This person has triggered Burnie ${totalContacts} times.`;
    }

    if (topViolation && topViolation[1] > 1) {
      insight += ` Mostly ${topViolation[0]}.`;
    }

    if (totalContacts >= 3) {
      if (complianceRate >= 70) {
        insight += ` You've said yes ${userSaidYes} out of ${totalContacts} times.`;
      } else if (complianceRate <= 30) {
        insight += ` You've been holding your ground well with them.`;
      }
    }

    return insight;
  },

  // ============================================
  // WEEKLY PATTERNS
  // ============================================

  async getWeeklySummary() {
    const stats = await Storage.getWeeklyStats();

    if (stats.totalViolations === 0) {
      return {
        hasData: false,
        summary: 'No boundary violations detected this week.'
      };
    }

    // Keys match exactly what's stored in interactions violations array
    const violationBreakdown = {
      'after_hours': stats.afterHours,
      'urgency': stats.urgency,
      'guilt': stats.guilt,
      'weekend': stats.weekend,
      'overload': stats.overload,
      'meeting_request': stats.meetingRequest || 0
    };

    const topThisWeek = Object.entries(violationBreakdown)
      .sort((a, b) => b[1] - a[1])
      .filter(([, count]) => count > 0)[0];

    return {
      hasData: true,
      totalViolations: stats.totalViolations,
      responded: stats.responded,
      dismissed: stats.dismissed,
      topViolationType: topThisWeek ? topThisWeek[0] : null,
      summary: this.buildWeeklySummary(stats, topThisWeek)
    };
  },

  buildWeeklySummary(stats, topViolation) {
    const LABELS = {
      after_hours: 'Off hours',
      urgency: 'Rush request',
      guilt: 'Guilt tactic',
      weekend: 'Weekend',
      overload: 'Overload',
      meeting_request: 'Meeting push'
    };

    let summary = `This week: ${stats.totalViolations} boundary violations detected.`;

    if (stats.responded > 0) {
      summary += ` You stood your ground ${stats.responded} time${stats.responded > 1 ? 's' : ''}.`;
    }

    if (topViolation) {
      const label = LABELS[topViolation[0]] || topViolation[0];
      summary += ` Most common: ${label}.`;
    }

    return summary;
  },

  // ============================================
  // TREND DETECTION
  // ============================================

  async detectTrend() {
    const interactions = await Storage.getInteractions();

    if (interactions.length < 10) {
      return { hasTrend: false };
    }

    const currentWeek = Storage.getWeekNumber();
    const lastWeek = currentWeek - 1;

    const thisWeekCount = interactions.filter(i => i.weekNumber === currentWeek).length;
    const lastWeekCount = interactions.filter(i => i.weekNumber === lastWeek).length;

    if (lastWeekCount === 0) return { hasTrend: false };

    const change = thisWeekCount - lastWeekCount;
    const percentChange = Math.round((change / lastWeekCount) * 100);

    return {
      hasTrend: Math.abs(percentChange) >= 20,
      direction: change > 0 ? 'worse' : 'better',
      percentChange: Math.abs(percentChange),
      thisWeekCount,
      lastWeekCount
    };
  },

  // ============================================
  // ENRICHED NUDGE
  // ============================================

  async enrichNudge(baseNudge, senderId) {
    const senderAnalysis = await this.analyzeSender(senderId);

    if (!senderAnalysis.isKnown) {
      return {
        nudge: baseNudge,
        memoryContext: null
      };
    }

    return {
      nudge: baseNudge,
      memoryContext: senderAnalysis.insight
    };
  }

};