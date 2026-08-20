import { DailyState, ParseResult } from '../types';

const extractTime = (text: string) => text.match(/\b\d{1,2}:\d{2}\b/)?.[0] || text.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i)?.[0] || null;

/** Private deterministic parser: runs inside the WebView and never uses the network. */
export function processOfflineUpdate(input: string, state: DailyState, now: string): ParseResult {
  const lower = input.toLowerCase();
  const newTimelineEvents: any[] = [];
  const completedTaskTitles: string[] = [];
  const newTasks: any[] = [];
  const newFixedEvents: any[] = [];
  const newReminders: any[] = [];
  let currentLocation = state.current.location;

  if (/reached office|arrived at office|in office/.test(lower)) {
    currentLocation = 'Office';
    newTimelineEvents.push({ time: extractTime(input) || now, type: 'EVENT', description: 'Reached office', location: 'Office' });
  } else if (/reached home|arrived home|at home|went home/.test(lower)) {
    currentLocation = 'Home';
    newTimelineEvents.push({ time: extractTime(input) || now, type: 'EVENT', description: 'Arrived at home', location: 'Home' });
  }

  if (/\b(done|finished|completed|submitted|sent|brought|fixed)\b/i.test(input)) {
    const description = input.replace(/^(i|i have|i've)\s+/i, '').trim();
    newTimelineEvents.push({ time: now, type: 'TASK_COMPLETED', description });
    const existing = state.tasks.find(task => lower.includes(task.title.toLowerCase()) || task.title.toLowerCase().split(/\s+/).filter(word => word.length > 3).some(word => lower.includes(word)));
    if (existing) completedTaskTitles.push(existing.title);
  }

  if (/meeting at|call at|meet at/i.test(input)) {
    newFixedEvents.push({ time: extractTime(input) || now, title: /recruiter/i.test(input) ? 'Recruiter meeting' : 'Scheduled meeting', category: 'OFFICE' });
  }
  if (/remind me/i.test(input)) {
    newReminders.push({ type: 'TIME_BASED', triggerCondition: extractTime(input) || 'Later today', message: input.replace(/.*remind me\s*(to|at)?\s*/i, '').trim() || input });
  }
  if (/idea:|idea for|reel idea/i.test(input)) {
    newTasks.push({ title: input.replace(/.*idea:?\s*/i, '').trim() || 'Captured idea', category: 'IDEAS', owner: 'ME', status: 'CAPTURED', priority: 4 });
  }

  const next = state.tasks.find(task => task.status === 'ACTIVE') || state.tasks.find(task => task.status === 'NEXT');
  const title = next?.title || 'Review your next actionable task';
  return {
    aiResponseText: `Updated locally. ${completedTaskTitles.length ? `Completed: ${completedTaskTitles.join(', ')}. ` : ''}Next best action: ${title}.`,
    extractedStateUpdate: {
      currentLocation, newTimelineEvents, completedTaskTitles, newTasks, newFixedEvents, newReminders,
      nextBestAction: { taskId: next?.id || null, title, rationale: 'Best available actionable priority.' },
      changesSummary: { tasksDone: completedTaskTitles, timelineAdded: newTimelineEvents.map(event => event.description), nextAction: title },
    },
  };
}

export function generateOfflineReview(state: DailyState) {
  const completed = state.tasks.filter(task => task.status === 'DONE');
  const pending = state.tasks.filter(task => ['NEXT', 'ACTIVE', 'CAPTURED'].includes(task.status));
  const waiting = state.tasks.filter(task => task.status === 'WAITING');
  const blocked = state.tasks.filter(task => task.status === 'BLOCKED');
  return {
    summaryNarrative: `You completed ${completed.length} tasks. ${pending.length} remain actionable, ${waiting.length} are waiting, and ${blocked.length} are blocked.`,
    plannedVsActual: state.fixedEvents.map(event => ({ event: event.title, planned: event.time, actual: 'Not logged', variance: 'Pending' })),
    recurringPatterns: [completed.length ? 'Completion activity was recorded today.' : 'No completed tasks were recorded yet.', pending.length ? 'Carry-forward work remains available.' : 'No carry-forward tasks remain.'],
    tomorrowAnchors: state.fixedEvents.map(event => ({ id: event.id, time: event.time, title: event.title, category: event.category })),
  };
}
