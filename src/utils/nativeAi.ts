import { AppMode, DailyState, ParseResult } from '../types';

export type NativeAiStatus = 'available' | 'downloading' | 'unavailable' | 'error';

export interface NativeAiResult {
  status: NativeAiStatus;
  result?: ParseResult;
  message?: string;
  modelName?: string;
}

interface NativeAiEventDetail {
  requestId: string;
  status: NativeAiStatus;
  output?: string;
  message?: string;
  modelName?: string;
}

const compactState = (state: DailyState, mode: AppMode, now: string) => {
  const activeTasks = state.tasks.filter((task) => task.status !== 'DONE' && task.status !== 'CANCELLED');
  const recentClosedTasks = state.tasks
    .filter((task) => task.status === 'DONE' || task.status === 'CANCELLED')
    .slice(-5);

  return {
    date: state.date,
    time: now,
    mode,
    current: state.current,
    tasks: [...activeTasks.slice(0, 35), ...recentClosedTasks].map((task) => ({
      id: task.id,
      title: task.title,
      category: task.category,
      owner: task.owner,
      status: task.status,
      priority: task.priority,
      dueAt: task.dueAt,
      scheduledAt: task.scheduledAt,
      estimatedMinutes: task.estimatedMinutes,
      location: task.location,
      blockedBy: task.blockedBy,
      trigger: task.trigger,
      notes: task.notes,
    })),
    fixedEvents: state.fixedEvents.slice(0, 20),
    reminders: state.reminders.filter((reminder) => !reminder.isDone).slice(0, 20),
    timetable: state.timetable.slice(0, 20),
    nextBestAction: state.nextBestAction,
    recentConversation: state.conversationHistory.slice(-4).map(({ sender, text, timestamp }) => ({
      sender,
      text,
      timestamp,
    })),
  };
};

function parseModelResult(output: string): ParseResult | null {
  try {
    const withoutFence = output.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const firstBrace = withoutFence.indexOf('{');
    const lastBrace = withoutFence.lastIndexOf('}');
    if (firstBrace < 0 || lastBrace <= firstBrace) return null;

    const parsed = JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
    if (typeof parsed?.aiResponseText !== 'string' || !parsed.extractedStateUpdate || typeof parsed.extractedStateUpdate !== 'object') {
      return null;
    }
    return parsed as ParseResult;
  } catch (error) {
    console.warn('Gemini Nano returned invalid structured output', error);
    return null;
  }
}

export function processWithOnDeviceAi(
  input: string,
  state: DailyState,
  mode: AppMode,
  now: string,
): Promise<NativeAiResult | null> {
  const bridge = window.DayTraceAndroid;
  if (!bridge?.processOnDeviceAi) return Promise.resolve(null);

  const requestId = `nano-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const stateContext = JSON.stringify(compactState(state, mode, now));

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: NativeAiResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('daytrace-native-ai-result', handleResult as EventListener);
      window.clearTimeout(timeout);
      resolve(result);
    };
    const handleResult = (event: Event) => {
      const detail = (event as CustomEvent<NativeAiEventDetail>).detail;
      if (!detail || detail.requestId !== requestId) return;

      if (detail.status === 'available' && detail.output) {
        const result = parseModelResult(detail.output);
        if (result) {
          finish({ status: 'available', result, modelName: detail.modelName });
          return;
        }
        finish({ status: 'error', message: 'Gemini Nano returned a response DayTrace could not safely apply.' });
        return;
      }
      finish({ status: detail.status, message: detail.message, modelName: detail.modelName });
    };
    const timeout = window.setTimeout(() => {
      finish({ status: 'error', message: 'Gemini Nano took too long to respond.' });
    }, 45_000);

    window.addEventListener('daytrace-native-ai-result', handleResult as EventListener);
    try {
      bridge.processOnDeviceAi(requestId, input, stateContext);
    } catch (error) {
      finish({ status: 'error', message: error instanceof Error ? error.message : 'Native AI bridge failed.' });
    }
  });
}
