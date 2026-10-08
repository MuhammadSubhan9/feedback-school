import { z } from "zod";

export const CATEGORIES = ["Suggestion / Idea", "School Facilities", "Academic Concern", "Student Wellbeing", "Rules / Policies", "Events & Activities", "Behaviour / Student Experience", "Safety Concern", "Complaint", "Appreciation / Positive Feedback", "Other"] as const;
export const STATUSES = ["New", "Under Review", "Action Planned", "In Progress", "Awaiting Action", "Referred / Escalated", "Resolved", "Closed — No Further Action", "Duplicate", "Invalid / Insufficient Information"] as const;
export const PRIORITIES = ["Normal", "Important", "Urgent"] as const;
export const FLAGS = ["Needs Attention", "Urgent", "Follow Up Required"] as const;
export const LOCATIONS = ["Classroom", "Corridor", "Cafeteria", "Playground", "Bus", "Other"] as const;
export const LOCATION_CATEGORIES: readonly string[] = ["School Facilities", "Student Wellbeing", "Behaviour / Student Experience", "Safety Concern", "Complaint", "Other"];
export const TERMINAL: readonly string[] = STATUSES.slice(6);
export const feedbackSchema = z.object({
  category: z.enum(CATEGORIES), subject: z.string().trim().min(3, "Add a short subject (at least 3 characters).").max(120),
  message: z.string().trim().min(10, "Add a little detail (at least 10 characters).").max(3000),
  priority: z.enum(PRIORITIES).default("Normal"), location: z.enum(LOCATIONS).nullable().optional(),
  website: z.string().max(0).optional(), submissionKey: z.string().uuid(), challenge: z.string().min(10).max(500)
}).strict();
export const changeSchema = z.object({
  status: z.enum(STATUSES), flags: z.array(z.enum(FLAGS)).max(3), publicUpdate: z.string().trim().max(600),
  reason: z.string().trim().max(1000).default(""), version: z.number().int().nonnegative()
}).strict().superRefine((v, ctx) => { if (TERMINAL.includes(v.status) && v.reason.length < 3) ctx.addIssue({code: "custom", path: ["reason"], message: "Add a short resolution reason."}); });
export type Submission = { id: string; referenceCode: string; category: string; subject: string; message: string; priority: string; location: string | null; status: string; flags: string[]; publicUpdate: string; createdAt: string; updatedAt: string; resolvedAt: string | null; archivedAt: string | null; version: number };
export type TimelineEntry = { id: string; event: string; actor: string | null; createdAt: string };
export type Note = { id: string; body: string; actor: string; createdAt: string };
export const formatDate = (v: string) => new Intl.DateTimeFormat("en-GB", {day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Riyadh"}).format(new Date(v));
export const formatTime = (v: string) => new Intl.DateTimeFormat("en-GB", {day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Riyadh"}).format(new Date(v));
