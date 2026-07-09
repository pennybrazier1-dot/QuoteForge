export type SiteVisitChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
};

export type SiteVisitMeasurement = {
  id: string;
  label: string;
  value: string;
  unit: string;
};

export type SiteVisitCapturedPhoto = {
  id: string;
  name: string;
  capturedAt: string;
};

export type SiteVisitVoiceNote = {
  id: string;
  label: string;
  capturedAt: string;
  durationSeconds: number;
};

export type SiteVisitSession = {
  enquiryId: string;
  startedAt: string;
  completedAt: string | null;
  voiceNotes: SiteVisitVoiceNote[];
  photos: SiteVisitCapturedPhoto[];
  measurements: SiteVisitMeasurement[];
  notes: string;
  checklist: SiteVisitChecklistItem[];
};

export type SiteVisitActionId =
  | "voice_note"
  | "photo"
  | "measurements"
  | "notes"
  | "checklist";

export type SiteVisitOrganisingStep = {
  id: string;
  label: string;
  done: boolean;
};
