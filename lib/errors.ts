import type { EventFormValues } from "@/lib/schemas/event";

export const RPC_ERROR_MESSAGES: Record<string, string> = {
  title_required: "Title is required.",
  invalid_status: "Invalid event status.",
  invalid_max_picks: "Max picks must be between 1 and 10.",
  event_in_past: "Event date must be in the future.",
  deadline_after_event: "Deadline must be before the event.",
  no_menu_items: "Add at least one menu item.",
  menu_item_name_required: "Every menu item must have a name.",
  host_not_found: "Host account not found. Please sign out and sign in again.",
  not_authenticated: "You must be signed in to create an event.",
};

type FieldPath = keyof EventFormValues | `menuItems.${number}.name`;

export function mapRpcError(error: unknown): {
  field?: FieldPath;
  message: string;
  redirect?: string;
} {
  const msg =
    error != null && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : "unknown_error";

  const human = RPC_ERROR_MESSAGES[msg] ?? "Something went wrong. Please try again.";

  if (msg === "not_authenticated") {
    return { message: human, redirect: "/login" };
  }
  if (msg === "title_required") {
    return { field: "title", message: human };
  }
  if (msg === "invalid_max_picks") {
    return { field: "maxPicksPerGuest", message: human };
  }
  if (msg === "event_in_past") {
    return { field: "eventDatetime", message: human };
  }
  if (msg === "deadline_after_event") {
    return { field: "responseDeadline", message: human };
  }
  if (msg === "no_menu_items") {
    return { field: "menuItems", message: human };
  }
  if (msg === "menu_item_name_required") {
    return { field: "menuItems.0.name", message: human };
  }
  return { message: human };
}
