export type ReminderPriority = 'FAIBLE' | 'NORMAL' | 'ELEVEE';
export type ReminderStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'DELETED';
export type ReminderRecurrenceType = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ADVANCED';
export type ReminderTargetType = 'ME' | 'USERS' | 'ROLES' | 'ALL_COMPANY';

export interface Reminder {
  id: number;
  title: string;
  description?: string;
  dueAt: string;
  timezone: string;
  priority: ReminderPriority;
  recurrenceType: ReminderRecurrenceType;
  recurrenceText?: string;
  targetType: ReminderTargetType;
  visibilityScope: 'TARGETS' | 'COMPANY';
  snoozeAllowed: boolean;
  snoozeMaxMin?: number;
  escalateAfterMin?: number;
  escalateToRole?: string;
  escalateToUserId?: number;
  status: ReminderStatus;
  createdById: number;
  updatedById?: number;
  createdAt: string;
  updatedAt: string;
  voiceMessageUrl?: string;
  allowVoiceResponses: boolean;
}

export interface ReminderVoiceResponse {
  id: number;
  reminderId: number;
  userId: number;
  voiceUrl: string;
  duration: number;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
  };
}


