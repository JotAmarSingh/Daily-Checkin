export type TaskStatus = 
  | 'CAPTURED'
  | 'NEXT'
  | 'ACTIVE'
  | 'WAITING'
  | 'BLOCKED'
  | 'SCHEDULED'
  | 'DONE'
  | 'CANCELLED';

export type TaskOwner = 
  | 'ME'
  | 'SPOUSE'
  | 'CLIENT'
  | 'BOSS'
  | 'IT_TEAM'
  | 'RECRUITER'
  | 'OTHER';

export type TaskCategory = 
  | 'OFFICE'
  | 'CAREER'
  | 'CLIENT'
  | 'CONTENT'
  | 'KHABARZAAR'
  | 'HOME'
  | 'FAMILY'
  | 'HEALTH'
  | 'PERSONAL'
  | 'IDEAS';

export type EnergyLevel = 
  | 'HIGH_FOCUS'
  | 'NORMAL'
  | 'LOW_ENERGY'
  | 'RUSHED'
  | 'DISTRACTED'
  | 'EMOTIONAL'
  | 'TIRED';

export type InterruptionClassification = 
  | 'EXPECTED'
  | 'UNEXPECTED'
  | 'AVOIDABLE'
  | 'UNAVOIDABLE';

export type ReminderType = 
  | 'TIME_BASED'
  | 'LOCATION_BASED'
  | 'EVENT_TRIGGERED';

export type RoutineRecurrence = 
  | 'DAILY' 
  | 'WEEKDAYS' 
  | 'WEEKENDS' 
  | 'MON_WED_FRI' 
  | 'TUE_THU' 
  | 'CUSTOM';

export type RoutineSlotStatus = 
  | 'PENDING' 
  | 'ACTIVE' 
  | 'COMPLETED' 
  | 'SKIPPED';

export interface TimetableSlot {
  id: string;
  title: string;
  category: TaskCategory;
  startTime: string; // "08:15"
  endTime: string;   // "09:15"
  durationMinutes: number;
  days: RoutineRecurrence;
  status: RoutineSlotStatus; // status for current day
  location?: 'HOME' | 'OFFICE' | 'GYM' | 'TRANSIT' | 'OUTDOORS' | 'ANY' | string;
  isRegularHabit: boolean;
  notes?: string;
  targetMetric?: string; // e.g. "Push workout", "High protein breakfast", "1 post + 10 replies"
  iconKey?: 'gym' | 'breakfast' | 'lunch' | 'social' | 'work' | 'coffee' | 'script' | 'reading' | 'night' | 'walk' | 'default';
}

export type AppMode = 
  | 'ACCOUNTABILITY'
  | 'NORMAL_CHAT'
  | 'RESEARCH'
  | 'CREATIVE';

export interface TaskItem {
  id: string;
  title: string;
  category: TaskCategory;
  owner: TaskOwner;
  status: TaskStatus;
  priority: number; // 1-10 (calculated dynamically)
  createdAt: string; // ISO or time string
  dueAt?: string;
  scheduledAt?: string;
  completedAt?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  location?: 'OFFICE' | 'HOME' | 'TRANSIT' | 'ANY' | string;
  context?: 'COMPUTER' | 'PHONE' | 'ERRAND' | 'MEETING' | 'ANY' | string;
  dependsOn?: string; // Task ID or title
  blockedBy?: string; // Task ID or description
  trigger?: string; // e.g., "IT confirms CRM workflow is live"
  recurring?: boolean;
  recurrenceRule?: 'DAILY' | 'WEEKDAYS' | 'WEEKLY' | 'CUSTOM';
  notes?: string;
  source?: string;
}

export interface TimelineEvent {
  id: string;
  time: string; // e.g. "09:10" or ISO
  type: 'EVENT' | 'TASK_STARTED' | 'TASK_COMPLETED' | 'INTERRUPTION' | 'MEETING' | 'DEPARTURE' | 'UPDATE';
  description: string;
  relatedTaskId?: string;
  location?: string;
  classification?: InterruptionClassification;
  source?: string;
  plannedTime?: string;
  varianceMinutes?: number;
  notes?: string;
}

export interface FixedEvent {
  id: string;
  time: string; // e.g. "11:30"
  endTime?: string;
  title: string;
  category?: TaskCategory;
  location?: string;
  prepTaskId?: string;
  notes?: string;
}

export interface ReminderItem {
  id: string;
  type: ReminderType;
  triggerCondition: string; // "13:00" or "Arriving Home" or "When IT confirms CRM"
  message: string;
  relatedTaskId?: string;
  isDone: boolean;
  createdAt: string;
}

export interface DailyState {
  date: string; // YYYY-MM-DD
  current: {
    location: string;
    activity: string;
    energy: EnergyLevel;
    focusTaskId: string | null;
    updatedAt: string;
  };
  fixedEvents: FixedEvent[];
  timeline: TimelineEvent[];
  tasks: TaskItem[];
  reminders: ReminderItem[];
  timetable: TimetableSlot[];
  nextBestAction: {
    taskId: string | null;
    title: string;
    rationale: string;
    category?: TaskCategory;
    estimatedMinutes?: number;
    urgencyReason?: string;
    secondaryRecommendations?: string[];
  } | null;
  conversationHistory: {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    timestamp: string;
    changesSummary?: {
      tasksDone?: string[];
      tasksWaiting?: string[];
      tasksBlocked?: string[];
      tasksCreated?: string[];
      timelineAdded?: string[];
      nextAction?: string;
    };
  }[];
}

export interface ParseResult {
  aiResponseText: string;
  extractedStateUpdate: {
    currentLocation?: string;
    currentActivity?: string;
    currentEnergy?: EnergyLevel;
    focusTaskId?: string | null;
    newTimelineEvents?: Omit<TimelineEvent, 'id'>[];
    updatedTasks?: Partial<TaskItem>[];
    newTasks?: Omit<TaskItem, 'id'>[];
    completedTaskTitles?: string[];
    cancelledTaskTitles?: string[];
    newFixedEvents?: Omit<FixedEvent, 'id'>[];
    newReminders?: Omit<ReminderItem, 'id'>[];
    nextBestAction?: {
      taskId?: string | null;
      title: string;
      rationale: string;
      category?: TaskCategory;
      estimatedMinutes?: number;
      secondaryRecommendations?: string[];
    };
    changesSummary?: {
      tasksDone?: string[];
      tasksWaiting?: string[];
      tasksBlocked?: string[];
      tasksCreated?: string[];
      timelineAdded?: string[];
      nextAction?: string;
    };
  };
}

export interface EndOfDayReview {
  date: string;
  timeline: TimelineEvent[];
  completedTasks: TaskItem[];
  pendingTasks: TaskItem[];
  waitingTasks: TaskItem[];
  blockedTasks: TaskItem[];
  interruptions: TimelineEvent[];
  plannedVsActual: {
    event: string;
    planned: string;
    actual: string;
    variance: string;
    notes?: string;
  }[];
  recurringPatterns: string[];
  carryForwardTasks: TaskItem[];
  tomorrowAnchors: FixedEvent[];
  summaryNarrative: string;
}
