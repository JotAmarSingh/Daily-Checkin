import { DailyState } from '../types';

export function createFreshDailyState(): DailyState {
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    date: localDate,
    current: {
      location: 'Not set',
      activity: 'Ready to plan',
      energy: 'NORMAL',
      focusTaskId: null,
      updatedAt: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    },
    fixedEvents: [],
    timeline: [],
    tasks: [],
    reminders: [],
    timetable: [],
    nextBestAction: null,
    conversationHistory: [],
  };
}
