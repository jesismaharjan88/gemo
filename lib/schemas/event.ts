import { z } from "zod";

export const menuItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Item name is required")
    .max(100, "Item name must be 100 characters or fewer"),
  description: z.string().trim().max(500, "Description must be 500 characters or fewer").optional(),
  category: z.string().trim().max(50, "Category must be 50 characters or fewer").optional(),
});

export const eventFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(200, "Title must be 200 characters or fewer"),
    venue: z
      .string()
      .trim()
      .max(200, "Venue must be 200 characters or fewer")
      .optional()
      .or(z.literal("")),
    eventDatetime: z
      .string()
      .min(1, "Event date and time is required")
      .refine((v) => !v || new Date(v) > new Date(), {
        message: "Event date must be in the future",
      }),
    description: z
      .string()
      .trim()
      .max(2000, "Description must be 2000 characters or fewer")
      .optional()
      .or(z.literal("")),
    maxPicksPerGuest: z
      .number({ error: "Must be a number" })
      .int("Must be a whole number")
      .min(1, "Minimum 1 pick")
      .max(10, "Maximum 10 picks"),
    responseDeadline: z
      .string()
      .min(1, "Response deadline is required")
      .refine((v) => !v || new Date(v) > new Date(), {
        message: "Deadline must be in the future",
      }),
    menuItems: z
      .array(menuItemSchema)
      .min(1, "Add at least one menu item"),
  })
  .superRefine((data, ctx) => {
    if (data.responseDeadline && data.eventDatetime) {
      if (new Date(data.responseDeadline) >= new Date(data.eventDatetime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Deadline must be before the event",
          path: ["responseDeadline"],
        });
      }
    }
  });

export type EventFormValues = z.infer<typeof eventFormSchema>;

export const STEP_1_FIELDS = [
  "title",
  "venue",
  "eventDatetime",
  "description",
  "maxPicksPerGuest",
  "responseDeadline",
] as const satisfies readonly (keyof EventFormValues)[];

export const STEP_2_FIELDS = ["menuItems"] as const satisfies readonly (keyof EventFormValues)[];

// Edit schema: same shape as EventFormValues but without "must be in the future" refinements.
// Structurally identical TypeScript output — EventEditFormValues === EventFormValues at the type level.
// Duplication noted; extract shared validators in a later refactor if the schemas diverge.
export const eventEditFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(200, "Title must be 200 characters or fewer"),
    venue: z
      .string()
      .trim()
      .max(200, "Venue must be 200 characters or fewer")
      .optional()
      .or(z.literal("")),
    eventDatetime: z.string().min(1, "Event date and time is required"),
    description: z
      .string()
      .trim()
      .max(2000, "Description must be 2000 characters or fewer")
      .optional()
      .or(z.literal("")),
    maxPicksPerGuest: z
      .number({ error: "Must be a number" })
      .int("Must be a whole number")
      .min(1, "Minimum 1 pick")
      .max(10, "Maximum 10 picks"),
    responseDeadline: z.string().min(1, "Response deadline is required"),
    menuItems: z.array(menuItemSchema).min(1, "Add at least one menu item"),
  })
  .superRefine((data, ctx) => {
    if (data.responseDeadline && data.eventDatetime) {
      if (new Date(data.responseDeadline) >= new Date(data.eventDatetime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Deadline must be before the event",
          path: ["responseDeadline"],
        });
      }
    }
  });

export type EventEditFormValues = z.infer<typeof eventEditFormSchema>;
