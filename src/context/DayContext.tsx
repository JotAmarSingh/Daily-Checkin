import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DailyState, TaskItem, TaskStatus, TimelineEvent, FixedEvent, ReminderItem, AppMode, EnergyLevel, TimetableSlot, RoutineSlotStatus } from '../types';
import { INITIAL_DAILY_STATE } from '../utils/initialState';
import { createFreshDailyState } from '../utils/freshState';
import { recordTaskInteraction, recordRoutineInteraction, getLearningProfile, resetLearningProfile, AutoLearningProfile } from '../utils/autoLearning';
import { processOfflineUpdate } from '../utils/offlineAi';
import { syncNativeSchedule } from '../utils/nativeBridge';

// v2 intentionally ignores the scaffold's pre-filled demonstration state.
const STORAGE_KEY = 'daytrace_state_v2';

interface DayContextType {
  state: DailyState;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isProcessing: boolean;
  processUserInput: (input: string) => Promise<string>;
  updateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  addTask: (task: Omit<TaskItem, 'id' | 'createdAt'>) => void;
  deleteTask: (taskId: string) => void;
  editTask: (taskId: string, updates: Partial<TaskItem>) => void;
  addTimelineEvent: (event: Omit<TimelineEvent, 'id'>) => void;
  deleteTimelineEvent: (eventId: string) => void;
  addFixedEvent: (event: Omit<FixedEvent, 'id'>) => void;
  deleteFixedEvent: (eventId: string) => void;
  toggleReminder: (reminderId: string) => void;
  addReminder: (reminder: Omit<ReminderItem, 'id' | 'createdAt' | 'isDone'>) => void;
  deleteReminder: (reminderId: string) => void;
  addTimetableSlot: (slot: Omit<TimetableSlot, 'id'>) => void;
  updateTimetableSlot: (id: string, updates: Partial<TimetableSlot>) => void;
  deleteTimetableSlot: (id: string) => void;
  toggleSlotStatus: (id: string, status: RoutineSlotStatus) => void;
  syncTimetableToDailyTasks: () => void;
  applyTimetablePreset: (presetType: 'BALANCED' | 'FITNESS_CREATOR' | 'DEEP_WORK') => void;
  setCurrentEnergy: (energy: EnergyLevel) => void;
  setCurrentLocation: (loc: string) => void;
  setFocusTask: (taskId: string | null) => void;
  resetToDefault: () => void;
  exportDataJSON: () => string;
  exportDataSheetsCSV: () => { [tab: string]: string };
  importDataJSON: (jsonStr: string) => boolean;
  currentTimeString: string;
  learningProfile: AutoLearningProfile;
  recordCustomRoutine: (id: string, label: string, prompt: string) => void;
  resetLearnedShortcuts: () => void;
}

const DayContext = createContext<DayContextType | undefined>(undefined);

export const DayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DailyState>(() => {
    const freshState = createFreshDailyState();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...freshState,
          ...parsed,
          timetable: Array.isArray(parsed.timetable) ? parsed.timetable : [],
        };
      }
    } catch (e) {
      console.error('Failed to load state from localStorage', e);
    }
    return freshState;
  });

  const [mode, setMode] = useState<AppMode>('ACCOUNTABILITY');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentTimeString, setCurrentTimeString] = useState<string>('09:45');
  const [learningProfile, setLearningProfileState] = useState<AutoLearningProfile>(() => getLearningProfile());

  const refreshLearningProfile = useCallback(() => {
    setLearningProfileState(getLearningProfile());
  }, []);

  const recordCustomRoutine = useCallback((id: string, label: string, prompt: string) => {
    recordRoutineInteraction(id, label, prompt);
    refreshLearningProfile();
  }, [refreshLearningProfile]);

  const resetLearnedShortcuts = useCallback(() => {
    const fresh = resetLearningProfile();
    setLearningProfileState(fresh);
  }, []);

  // Sync with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
    syncNativeSchedule(state);
  }, [state]);

  // Live time ticker
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      setCurrentTimeString(`${h}:${m}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Process natural language input locally; no API key or network is required.
  const processUserInput = useCallback(async (userInput: string): Promise<string> => {
    if (!userInput.trim()) return '';
    setIsProcessing(true);

    const userMessageId = `msg-${Date.now()}`;
    const userTimestamp = currentTimeString;

    // Immediately record user message in history
    setState((prev) => ({
      ...prev,
      conversationHistory: [
        ...prev.conversationHistory,
        {
          id: userMessageId,
          sender: 'user',
          text: userInput,
          timestamp: userTimestamp,
        },
      ],
    }));

    try {
      const data = processOfflineUpdate(userInput, state, userTimestamp);
      const { aiResponseText, extractedStateUpdate } = data;

      // Apply extracted state updates cleanly
      setState((prev) => {
        let updatedTasks = [...prev.tasks];
        let updatedTimeline = [...prev.timeline];
        let updatedFixed = [...prev.fixedEvents];
        let updatedReminders = [...prev.reminders];

        // 1. Process completed tasks (from explicit title match or extraction)
        if (extractedStateUpdate?.completedTaskTitles?.length) {
          const compTitles = extractedStateUpdate.completedTaskTitles.map((t: string) => t.toLowerCase());
          updatedTasks = updatedTasks.map((task) => {
            const match = compTitles.some((title: string) =>
              task.title.toLowerCase().includes(title) || title.includes(task.title.toLowerCase())
            );
            if (match && task.status !== 'DONE') {
              recordTaskInteraction(task.title, task.id, 'COMPLETE', task.category);
              return {
                ...task,
                status: 'DONE' as TaskStatus,
                completedAt: userTimestamp,
              };
            }
            return task;
          });
        }

        // 2. Process task updates
        if (extractedStateUpdate?.updatedTasks?.length) {
          extractedStateUpdate.updatedTasks.forEach((up: any) => {
            const index = updatedTasks.findIndex(
              (t) => (up.id && t.id === up.id) || (up.title && t.title.toLowerCase() === up.title.toLowerCase())
            );
            if (index !== -1) {
              const currentT = updatedTasks[index];
              if (up.status === 'DONE') {
                recordTaskInteraction(currentT.title, currentT.id, 'COMPLETE', currentT.category);
              } else if (up.status === 'ACTIVE') {
                recordTaskInteraction(currentT.title, currentT.id, 'START', currentT.category);
              } else {
                recordTaskInteraction(currentT.title, currentT.id, 'UPDATE', currentT.category);
              }
              updatedTasks[index] = { ...currentT, ...up };
            }
          });
        }

        // 3. Process new tasks (with duplicate check)
        if (extractedStateUpdate?.newTasks?.length) {
          extractedStateUpdate.newTasks.forEach((nt: any) => {
            const exists = updatedTasks.some(
              (t) => t.title.toLowerCase() === nt.title.toLowerCase() && t.category === nt.category
            );
            if (!exists) {
              const newId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
              recordTaskInteraction(nt.title, newId, 'UPDATE', nt.category || 'OFFICE');
              updatedTasks.push({
                id: newId,
                createdAt: userTimestamp,
                priority: 6,
                ...nt,
              });
            }
          });
        }

        // 4. Process dependency unlocks: if a blocking task just became DONE, unblock dependent tasks
        const doneTaskTitles = updatedTasks.filter((t) => t.status === 'DONE').map((t) => t.title.toLowerCase());
        updatedTasks = updatedTasks.map((task) => {
          if (task.status === 'BLOCKED' && task.blockedBy) {
            const blockerDone = doneTaskTitles.some((title) =>
              task.blockedBy?.toLowerCase().includes(title)
            );
            if (blockerDone) {
              return { ...task, status: 'NEXT' as TaskStatus };
            }
          }
          return task;
        });

        // 5. Process new timeline events
        if (extractedStateUpdate?.newTimelineEvents?.length) {
          extractedStateUpdate.newTimelineEvents.forEach((ev: any) => {
            updatedTimeline.push({
              id: `time-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              time: ev.time || userTimestamp,
              ...ev,
            });
          });
        }

        // 6. Process new fixed events
        if (extractedStateUpdate?.newFixedEvents?.length) {
          extractedStateUpdate.newFixedEvents.forEach((fe: any) => {
            const exists = updatedFixed.some((f) => f.title.toLowerCase() === fe.title.toLowerCase());
            if (!exists) {
              updatedFixed.push({
                id: `fix-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                ...fe,
              });
            }
          });
        }

        // 7. Process new reminders
        if (extractedStateUpdate?.newReminders?.length) {
          extractedStateUpdate.newReminders.forEach((rem: any) => {
            updatedReminders.push({
              id: `rem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              createdAt: userTimestamp,
              isDone: false,
              ...rem,
            });
          });
        }

        // Determine current location & activity
        const newLocation = extractedStateUpdate?.currentLocation || prev.current.location;
        const newActivity = extractedStateUpdate?.currentActivity || prev.current.activity;
        const newEnergy = extractedStateUpdate?.currentEnergy || prev.current.energy;

        // Next Best Action
        const nextAction = extractedStateUpdate?.nextBestAction
          ? {
              taskId: extractedStateUpdate.nextBestAction.taskId || null,
              title: extractedStateUpdate.nextBestAction.title,
              rationale: extractedStateUpdate.nextBestAction.rationale,
              category: extractedStateUpdate.nextBestAction.category,
              estimatedMinutes: extractedStateUpdate.nextBestAction.estimatedMinutes,
              secondaryRecommendations: extractedStateUpdate.nextBestAction.secondaryRecommendations,
            }
          : prev.nextBestAction;

        return {
          ...prev,
          current: {
            ...prev.current,
            location: newLocation,
            activity: newActivity,
            energy: newEnergy,
            updatedAt: userTimestamp,
          },
          tasks: updatedTasks,
          timeline: updatedTimeline,
          fixedEvents: updatedFixed,
          reminders: updatedReminders,
          nextBestAction: nextAction,
          conversationHistory: [
            ...prev.conversationHistory,
            {
              id: `ai-${Date.now()}`,
              sender: 'ai',
              text: aiResponseText || 'State updated according to your message.',
              timestamp: userTimestamp,
              changesSummary: extractedStateUpdate?.changesSummary,
            },
          ],
        };
      });

      return aiResponseText;
    } catch (err) {
      console.error('Failed to process message with AI', err);
      return 'Encountered an issue processing. Recorded your message.';
    } finally {
      setIsProcessing(false);
    }
  }, [state, mode, currentTimeString]);

  // Update task status with automatic dependency cascade
  const updateTaskStatus = useCallback((taskId: string, newStatus: TaskStatus) => {
    setState((prev) => {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const targetTask = prev.tasks.find((t) => t.id === taskId);
      if (!targetTask) return prev;

      // Record learned task interaction
      if (newStatus === 'DONE') {
        recordTaskInteraction(targetTask.title, targetTask.id, 'COMPLETE', targetTask.category);
      } else if (newStatus === 'ACTIVE') {
        recordTaskInteraction(targetTask.title, targetTask.id, 'START', targetTask.category);
      } else {
        recordTaskInteraction(targetTask.title, targetTask.id, 'UPDATE', targetTask.category);
      }

      let updatedTasks = prev.tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            status: newStatus,
            completedAt: newStatus === 'DONE' ? now : t.completedAt,
          };
        }
        return t;
      });

      // If task was completed, unblock dependent tasks
      if (newStatus === 'DONE') {
        const completedTitle = targetTask.title.toLowerCase();
        updatedTasks = updatedTasks.map((t) => {
          if (t.status === 'BLOCKED' && t.blockedBy && t.blockedBy.toLowerCase().includes(completedTitle)) {
            return { ...t, status: 'NEXT' as TaskStatus };
          }
          return t;
        });
      }

      // Add timeline entry if marked done or active
      let updatedTimeline = [...prev.timeline];
      if (newStatus === 'DONE') {
        updatedTimeline.push({
          id: `time-${Date.now()}`,
          time: now,
          type: 'TASK_COMPLETED',
          description: `Completed: ${targetTask.title}`,
          relatedTaskId: taskId,
          location: prev.current.location,
        });
      } else if (newStatus === 'ACTIVE') {
        updatedTimeline.push({
          id: `time-${Date.now()}`,
          time: now,
          type: 'TASK_STARTED',
          description: `Started: ${targetTask.title}`,
          relatedTaskId: taskId,
          location: prev.current.location,
        });
      }

      return {
        ...prev,
        current: {
          ...prev.current,
          focusTaskId: newStatus === 'ACTIVE' ? taskId : prev.current.focusTaskId === taskId ? null : prev.current.focusTaskId,
        },
        tasks: updatedTasks,
        timeline: updatedTimeline,
      };
    });
    refreshLearningProfile();
  }, [refreshLearningProfile]);

  const addTask = useCallback((taskData: Omit<TaskItem, 'id' | 'createdAt'>) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      createdAt: now,
      ...taskData,
    };
    setState((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
      current: {
        ...prev.current,
        focusTaskId: prev.current.focusTaskId === taskId ? null : prev.current.focusTaskId,
      },
    }));
  }, []);

  const editTask = useCallback((taskId: string, updates: Partial<TaskItem>) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
    }));
  }, []);

  const addTimelineEvent = useCallback((eventData: Omit<TimelineEvent, 'id'>) => {
    setState((prev) => ({
      ...prev,
      timeline: [
        ...prev.timeline,
        {
          id: `time-${Date.now()}`,
          ...eventData,
        },
      ],
    }));
  }, []);

  const deleteTimelineEvent = useCallback((eventId: string) => {
    setState((prev) => ({
      ...prev,
      timeline: prev.timeline.filter((e) => e.id !== eventId),
    }));
  }, []);

  const addFixedEvent = useCallback((eventData: Omit<FixedEvent, 'id'>) => {
    setState((prev) => ({
      ...prev,
      fixedEvents: [
        ...prev.fixedEvents,
        {
          id: `fix-${Date.now()}`,
          ...eventData,
        },
      ],
    }));
  }, []);

  const deleteFixedEvent = useCallback((eventId: string) => {
    setState((prev) => ({
      ...prev,
      fixedEvents: prev.fixedEvents.filter((e) => e.id !== eventId),
    }));
  }, []);

  const toggleReminder = useCallback((reminderId: string) => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) =>
        r.id === reminderId ? { ...r, isDone: !r.isDone } : r
      ),
    }));
  }, []);

  const addReminder = useCallback((reminderData: Omit<ReminderItem, 'id' | 'createdAt' | 'isDone'>) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    setState((prev) => ({
      ...prev,
      reminders: [
        ...prev.reminders,
        {
          id: `rem-${Date.now()}`,
          createdAt: now,
          isDone: false,
          ...reminderData,
        },
      ],
    }));
  }, []);

  const deleteReminder = useCallback((reminderId: string) => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.filter((r) => r.id !== reminderId),
    }));
  }, []);

  const addTimetableSlot = useCallback((slotData: Omit<TimetableSlot, 'id'>) => {
    setState((prev) => ({
      ...prev,
      timetable: [
        ...(prev.timetable || []),
        {
          id: `slot-${Date.now()}`,
          ...slotData,
        },
      ].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }));
  }, []);

  const updateTimetableSlot = useCallback((id: string, updates: Partial<TimetableSlot>) => {
    setState((prev) => ({
      ...prev,
      timetable: (prev.timetable || []).map((s) => (s.id === id ? { ...s, ...updates } : s))
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }));
  }, []);

  const deleteTimetableSlot = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      timetable: (prev.timetable || []).filter((s) => s.id !== id),
    }));
  }, []);

  const toggleSlotStatus = useCallback((id: string, status: RoutineSlotStatus) => {
    setState((prev) => {
      const slot = (prev.timetable || []).find((s) => s.id === id);
      if (!slot) return prev;

      // Also record interaction in auto-learning
      if (status === 'COMPLETED') {
        recordTaskInteraction(slot.title, slot.id, 'COMPLETE', slot.category);
      } else if (status === 'ACTIVE') {
        recordTaskInteraction(slot.title, slot.id, 'START', slot.category);
      }

      return {
        ...prev,
        timetable: (prev.timetable || []).map((s) => (s.id === id ? { ...s, status } : s)),
      };
    });
    refreshLearningProfile();
  }, [refreshLearningProfile]);

  const syncTimetableToDailyTasks = useCallback(() => {
    setState((prev) => {
      const currentTasks = [...prev.tasks];
      const currentReminders = [...prev.reminders];
      const slots = prev.timetable || [];

      slots.forEach((slot) => {
        // Check if task exists for this routine
        const existingTask = currentTasks.find(
          (t) => t.title.toLowerCase() === slot.title.toLowerCase()
        );

        if (!existingTask) {
          currentTasks.push({
            id: `task-routine-${slot.id}`,
            title: slot.title,
            category: slot.category,
            owner: 'ME',
            status: slot.status === 'COMPLETED' ? 'DONE' : slot.status === 'ACTIVE' ? 'ACTIVE' : 'NEXT',
            priority: 8,
            createdAt: slot.startTime,
            scheduledAt: slot.startTime,
            estimatedMinutes: slot.durationMinutes,
            recurring: true,
            recurrenceRule: 'DAILY',
            notes: slot.targetMetric || slot.notes,
          });
        }
      });

      return {
        ...prev,
        tasks: currentTasks,
      };
    });
  }, []);

  const applyTimetablePreset = useCallback((presetType: 'BALANCED' | 'FITNESS_CREATOR' | 'DEEP_WORK') => {
    let presetSlots: Omit<TimetableSlot, 'id'>[] = [];

    if (presetType === 'FITNESS_CREATOR') {
      presetSlots = [
        {
          title: 'High-Protein Breakfast & Hydration',
          category: 'HEALTH',
          startTime: '07:00',
          endTime: '07:45',
          durationMinutes: 45,
          days: 'DAILY',
          status: 'COMPLETED',
          location: 'HOME',
          isRegularHabit: true,
          targetMetric: '40g protein + 750ml water',
          iconKey: 'breakfast',
          notes: 'Fuel optimal metabolism and energy',
        },
        {
          title: 'Gym & Core Strength Session',
          category: 'HEALTH',
          startTime: '07:45',
          endTime: '09:00',
          durationMinutes: 75,
          days: 'DAILY',
          status: 'COMPLETED',
          location: 'GYM',
          isRegularHabit: true,
          targetMetric: 'Heavy compound lift + stretching',
          iconKey: 'gym',
          notes: 'Consistent athletic habit',
        },
        {
          title: 'Morning Social Media Post & Engagement',
          category: 'CONTENT',
          startTime: '09:30',
          endTime: '10:15',
          durationMinutes: 45,
          days: 'DAILY',
          status: 'ACTIVE',
          location: 'OFFICE',
          isRegularHabit: true,
          targetMetric: 'Post reel/thread + 15 min community engagement',
          iconKey: 'social',
          notes: 'Peak algorithm distribution window',
        },
        {
          title: 'High Priority Client & Office Deliverables',
          category: 'OFFICE',
          startTime: '10:15',
          endTime: '13:00',
          durationMinutes: 165,
          days: 'WEEKDAYS',
          status: 'PENDING',
          location: 'OFFICE',
          isRegularHabit: true,
          targetMetric: 'Deliver key sprint items without interruptions',
          iconKey: 'work',
          notes: 'Zero distraction block',
        },
        {
          title: 'Lunch, Outdoor Sunlight & Walk',
          category: 'HEALTH',
          startTime: '13:00',
          endTime: '14:00',
          durationMinutes: 60,
          days: 'DAILY',
          status: 'PENDING',
          location: 'HOME',
          isRegularHabit: true,
          targetMetric: 'Clean meal + 2,000 steps walk',
          iconKey: 'lunch',
          notes: 'Regulate circadian rhythm',
        },
        {
          title: 'Career & Inbound Opportunity Sync',
          category: 'CAREER',
          startTime: '14:00',
          endTime: '16:30',
          durationMinutes: 150,
          days: 'WEEKDAYS',
          status: 'PENDING',
          location: 'OFFICE',
          isRegularHabit: true,
          targetMetric: 'Follow up on contracts, proposals & job leads',
          iconKey: 'work',
          notes: 'High leverage networking',
        },
        {
          title: 'Content Scriptwriting & Video Production',
          category: 'CONTENT',
          startTime: '17:30',
          endTime: '19:00',
          durationMinutes: 90,
          days: 'WEEKDAYS',
          status: 'PENDING',
          location: 'HOME',
          isRegularHabit: true,
          targetMetric: 'Batch 2 video scripts or Khabarzaar curation',
          iconKey: 'script',
          notes: 'Creative studio time',
        },
        {
          title: 'Night Review, Journal & Wind-down',
          category: 'PERSONAL',
          startTime: '21:30',
          endTime: '22:15',
          durationMinutes: 45,
          days: 'DAILY',
          status: 'PENDING',
          location: 'HOME',
          isRegularHabit: true,
          targetMetric: 'Close today loop, set tomorrow 3 anchors',
          iconKey: 'night',
          notes: 'Unwind and screens off by 22:30',
        },
      ];
    } else if (presetType === 'DEEP_WORK') {
      presetSlots = [
        {
          title: 'Morning Fuel & Day Blueprint',
          category: 'HEALTH',
          startTime: '07:30',
          endTime: '08:15',
          durationMinutes: 45,
          days: 'DAILY',
          status: 'COMPLETED',
          location: 'HOME',
          isRegularHabit: true,
          targetMetric: 'Healthy breakfast + review top 3 outcomes',
          iconKey: 'breakfast',
        },
        {
          title: 'Deep Work Block 1 (Hardest Task)',
          category: 'OFFICE',
          startTime: '08:30',
          endTime: '11:30',
          durationMinutes: 180,
          days: 'WEEKDAYS',
          status: 'ACTIVE',
          location: 'OFFICE',
          isRegularHabit: true,
          targetMetric: 'Complete core development/proposal',
          iconKey: 'work',
        },
        {
          title: 'Social & Industry Presence',
          category: 'CONTENT',
          startTime: '11:30',
          endTime: '12:00',
          durationMinutes: 30,
          days: 'WEEKDAYS',
          status: 'PENDING',
          location: 'OFFICE',
          isRegularHabit: true,
          targetMetric: 'Share morning insight & engage with peers',
          iconKey: 'social',
        },
        {
          title: 'Lunch & Screen Detox',
          category: 'HEALTH',
          startTime: '12:30',
          endTime: '13:30',
          durationMinutes: 60,
          days: 'DAILY',
          status: 'PENDING',
          location: 'HOME',
          isRegularHabit: true,
          targetMetric: 'Restful lunch without screens',
          iconKey: 'lunch',
        },
        {
          title: 'Deep Work Block 2 (Execution)',
          category: 'OFFICE',
          startTime: '13:30',
          endTime: '16:30',
          durationMinutes: 180,
          days: 'WEEKDAYS',
          status: 'PENDING',
          location: 'OFFICE',
          isRegularHabit: true,
          targetMetric: 'Code review, client revisions, workflow handoff',
          iconKey: 'work',
        },
        {
          title: 'Evening Gym & Functional Movement',
          category: 'HEALTH',
          startTime: '17:30',
          endTime: '18:45',
          durationMinutes: 75,
          days: 'DAILY',
          status: 'PENDING',
          location: 'GYM',
          isRegularHabit: true,
          targetMetric: 'Workout + sauna / recovery',
          iconKey: 'gym',
        },
        {
          title: 'Evening Debrief & Night Routine',
          category: 'PERSONAL',
          startTime: '21:30',
          endTime: '22:00',
          durationMinutes: 30,
          days: 'DAILY',
          status: 'PENDING',
          location: 'HOME',
          isRegularHabit: true,
          targetMetric: 'Log review and sleep preparation',
          iconKey: 'night',
        },
      ];
    } else {
      presetSlots = INITIAL_DAILY_STATE.timetable.map(({ id, ...rest }) => rest);
    }

    setState((prev) => ({
      ...prev,
      timetable: presetSlots.map((slot, index) => ({
        id: `slot-preset-${Date.now()}-${index}`,
        ...slot,
      })),
    }));
  }, []);

  const setCurrentEnergy = useCallback((energy: EnergyLevel) => {
    setState((prev) => ({
      ...prev,
      current: { ...prev.current, energy },
    }));
  }, []);

  const setCurrentLocation = useCallback((location: string) => {
    setState((prev) => ({
      ...prev,
      current: { ...prev.current, location },
    }));
  }, []);

  const setFocusTask = useCallback((taskId: string | null) => {
    setState((prev) => {
      let updatedTasks = prev.tasks;
      if (taskId) {
        updatedTasks = updatedTasks.map((t) => (t.id === taskId ? { ...t, status: 'ACTIVE' as TaskStatus } : t));
      }
      return {
        ...prev,
        current: { ...prev.current, focusTaskId: taskId },
        tasks: updatedTasks,
      };
    });
  }, []);

  const resetToDefault = useCallback(() => {
    setState(createFreshDailyState());
  }, []);

  const exportDataJSON = useCallback(() => {
    return JSON.stringify(state, null, 2);
  }, [state]);

  const exportDataSheetsCSV = useCallback(() => {
    // Generate Google Sheets structure tabs (TODAY, TASKS, TIMELINE, RECURRING, WAITING)
    const todayCSV = `Metric,Value\nDate,${state.date}\nLocation,${state.current.location}\nEnergy,${state.current.energy}\nFocus Task,${state.nextBestAction?.title || 'None'}\nUpdated,${state.current.updatedAt}`;
    
    const tasksCSV = `ID,Title,Category,Owner,Status,Priority,DueAt,BlockedBy,Trigger\n` +
      state.tasks.map(t => `"${t.id}","${t.title}","${t.category}","${t.owner}","${t.status}",${t.priority},"${t.dueAt || ''}","${t.blockedBy || ''}","${t.trigger || ''}"`).join('\n');

    const timelineCSV = `Time,Type,Description,Location,Variance\n` +
      state.timeline.map(e => `"${e.time}","${e.type}","${e.description}","${e.location || ''}","${e.varianceMinutes ? `${e.varianceMinutes}m` : ''}"`).join('\n');

    const waitingCSV = `Title,Owner,Category,Status,Notes\n` +
      state.tasks.filter(t => t.status === 'WAITING' || t.status === 'BLOCKED').map(t => `"${t.title}","${t.owner}","${t.category}","${t.status}","${t.blockedBy || t.notes || ''}"`).join('\n');

    const timetableCSV = `Slot,Category,Time Window,Duration,Days,Status,Goal\n` +
      (state.timetable || []).map(s => `"${s.title}","${s.category}","${s.startTime}-${s.endTime}",${s.durationMinutes},"${s.days}","${s.status}","${s.targetMetric || ''}"`).join('\n');

    return {
      TODAY: todayCSV,
      TIMETABLE: timetableCSV,
      TASKS: tasksCSV,
      TIMELINE: timelineCSV,
      WAITING: waitingCSV,
    };
  }, [state]);

  const importDataJSON = useCallback((jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && parsed.tasks && parsed.timeline) {
        setState(parsed);
        return true;
      }
    } catch (e) {
      console.error('Invalid JSON import', e);
    }
    return false;
  }, []);

  return (
    <DayContext.Provider
      value={{
        state,
        mode,
        setMode,
        isProcessing,
        processUserInput,
        updateTaskStatus,
        addTask,
        deleteTask,
        editTask,
        addTimelineEvent,
        deleteTimelineEvent,
        addFixedEvent,
        deleteFixedEvent,
        toggleReminder,
        addReminder,
        deleteReminder,
        addTimetableSlot,
        updateTimetableSlot,
        deleteTimetableSlot,
        toggleSlotStatus,
        syncTimetableToDailyTasks,
        applyTimetablePreset,
        setCurrentEnergy,
        setCurrentLocation,
        setFocusTask,
        resetToDefault,
        exportDataJSON,
        exportDataSheetsCSV,
        importDataJSON,
        currentTimeString,
        learningProfile,
        recordCustomRoutine,
        resetLearnedShortcuts,
      }}
    >
      {children}
    </DayContext.Provider>
  );
};

export const useDay = () => {
  const context = useContext(DayContext);
  if (!context) throw new Error('useDay must be used within DayProvider');
  return context;
};
