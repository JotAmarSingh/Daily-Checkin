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
  const responseParts: string[] = [];

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
    if (existing) {
      completedTaskTitles.push(existing.title);
      responseParts.push(`Marked “${existing.title}” complete.`);
    }
  }

  if (/meeting at|call at|meet at/i.test(input)) {
    newFixedEvents.push({ time: extractTime(input) || now, title: /recruiter/i.test(input) ? 'Recruiter meeting' : 'Scheduled meeting', category: 'OFFICE' });
  }
  if (/remind me/i.test(input)) {
    const reminderMessage = input.replace(/.*remind me\s*(to|at)?\s*/i, '').trim() || input;
    newReminders.push({ type: 'TIME_BASED', triggerCondition: extractTime(input) || 'Later today', message: reminderMessage });
    responseParts.push(`Added a reminder for “${reminderMessage}”.`);
  }
  if (/idea:|idea for|reel idea/i.test(input)) {
    const ideaTitle = input.replace(/.*idea:?\s*/i, '').trim() || 'Captured idea';
    newTasks.push({ title: ideaTitle, category: 'IDEAS', owner: 'ME', status: 'CAPTURED', priority: 4 });
    responseParts.push(`Captured the idea “${ideaTitle}”.`);
  }

  if (newTasks.length === 0 && !/\b(done|finished|completed|submitted|sent|brought|fixed)\b/i.test(input)) {
    const taskMatch = input.match(/(?:^|\b)(?:add(?: a)? task(?: to)?|need to|have to|must|todo:?|to-do:?)\s+(.+)/i);
    if (taskMatch?.[1]) {
      const taskTitle = taskMatch[1].replace(/[.!]+$/, '').trim();
      if (taskTitle) {
        newTasks.push({ title: taskTitle, category: 'PERSONAL', owner: 'ME', status: 'NEXT', priority: 6 });
        responseParts.push(`Added “${taskTitle}” to Next tasks.`);
      }
    }
  }

  if (
    newTimelineEvents.length === 0 &&
    newTasks.length === 0 &&
    newFixedEvents.length === 0 &&
    newReminders.length === 0 &&
    completedTaskTitles.length === 0
  ) {
    newTimelineEvents.push({ time: now, type: 'UPDATE', description: input.trim() });
    responseParts.push(`Logged your update exactly as written: “${input.trim()}”.`);
  }

  const next = state.tasks.find(task => task.status === 'ACTIVE') || state.tasks.find(task => task.status === 'NEXT');
  const title = next?.title || newTasks[0]?.title || null;
  if (title) responseParts.push(`Next best action: ${title}.`);
  return {
    aiResponseText: responseParts.join(' '),
    extractedStateUpdate: {
      currentLocation, newTimelineEvents, completedTaskTitles, newTasks, newFixedEvents, newReminders,
      nextBestAction: title ? { taskId: next?.id || null, title, rationale: 'Best available actionable priority.' } : undefined,
      changesSummary: {
        tasksDone: completedTaskTitles,
        tasksCreated: newTasks.map(task => task.title),
        timelineAdded: newTimelineEvents.map(event => event.description),
        nextAction: title || undefined,
      },
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
