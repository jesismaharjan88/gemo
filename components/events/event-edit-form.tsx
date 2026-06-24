"use client";

import { useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { createClient } from "@/lib/supabase/client";
import { useLoadingOverlay } from "@/components/loading-overlay";
import { eventEditFormSchema, type EventEditFormValues } from "@/lib/schemas/event";
import { APP_NAME } from "@/lib/constants";
import MenuItemCard from "./menu-item-card";
import TimezoneHint from "@/components/timezone-hint";
import type { EventFormValues } from "@/lib/schemas/event";

// Convert a UTC ISO string from Postgres to the YYYY-MM-DDTHH:mm format that
// <input type="datetime-local"> expects (which is local-time, not UTC).
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputClass =
  "w-full px-3 py-2.5 rounded-[10px] text-sm outline-none border transition-colors";
const inputStyle = {
  backgroundColor: "var(--bg)",
  borderColor: "var(--border-med)",
  color: "var(--text)",
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-xs" style={{ color: "#dc2626" }} role="alert">
      {message}
    </p>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium mb-1"
      style={{ color: "var(--text)" }}
    >
      {children}
    </label>
  );
}

type EventRow = {
  id: string;
  slug: string;
  title: string;
  venue_name: string | null;
  event_datetime: string;
  description: string | null;
  max_picks_per_guest: number;
  response_deadline: string;
  status: string;
};

type MenuItemRow = {
  name: string;
  description: string | null;
  category: string | null;
  sort_order: number;
};

type Props = {
  event: EventRow;
  menuItems: MenuItemRow[];
  mode: "full" | "metadata";
  responseCount: number;
};

export default function EventEditForm({ event, menuItems, mode, responseCount }: Props) {
  const router = useRouter();
  const { show: showLoading, hide: hideLoading } = useLoadingOverlay();

  const defaultValues: EventEditFormValues = {
    title: event.title,
    venue: event.venue_name ?? "",
    eventDatetime: toDatetimeLocal(event.event_datetime),
    description: event.description ?? "",
    maxPicksPerGuest: event.max_picks_per_guest,
    responseDeadline: toDatetimeLocal(event.response_deadline),
    menuItems:
      menuItems.length > 0
        ? menuItems.map((item) => ({
            name: item.name,
            description: item.description ?? "",
            category: item.category ?? "",
          }))
        : [{ name: "", description: "", category: "" }],
  };

  const form = useForm<EventEditFormValues>({
    resolver: zodResolver(eventEditFormSchema),
    defaultValues,
    mode: "onTouched",
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  // Cast is safe: EventEditFormValues and EventFormValues are structurally identical.
  const formAsCreate = form as unknown as import("react-hook-form").UseFormReturn<EventFormValues>;

  const { fields, append, remove, move } = useFieldArray({ control, name: "menuItems" });
  const newRowRef = useRef<HTMLInputElement | null>(null);

  // Initialize categories from the loaded menu items' distinct category values
  const [categories, setCategories] = useState<string[]>(() => {
    const seen = new Set<string>();
    const cats: string[] = [];
    for (const item of defaultValues.menuItems) {
      if (item.category && !seen.has(item.category)) {
        seen.add(item.category);
        cats.push(item.category);
      }
    }
    return cats;
  });
  const [newCategory, setNewCategory] = useState("");

  function addCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed || categories.includes(trimmed)) {
      setNewCategory("");
      return;
    }
    setCategories((prev) => [...prev, trimmed]);
    setNewCategory("");
  }

  function removeCategory(cat: string) {
    const items = form.getValues("menuItems");
    items.forEach((item, i) => {
      if (item.category === cat) {
        form.setValue(`menuItems.${i}.category`, "");
      }
    });
    setCategories((prev) => prev.filter((c) => c !== cat));
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) move(oldIndex, newIndex);
  }

  function handleAdd() {
    append({ name: "", description: "", category: "" });
    requestAnimationFrame(() => newRowRef.current?.focus());
  }

  const onSubmit = useCallback(
    async (values: EventEditFormValues) => {
      showLoading();
      const supabase = createClient();

      if (mode === "metadata") {
        const { error } = await supabase.rpc("update_event_metadata", {
          p_event_id: event.id,
          p_title: values.title,
          p_venue: values.venue || null,
          p_datetime: new Date(values.eventDatetime).toISOString(),
          p_description: values.description || null,
          p_response_deadline: new Date(values.responseDeadline).toISOString(),
        });
        if (error) {
          hideLoading();
          toast.error("Couldn't update event. Try again.");
          return;
        }
      } else {
        const { error } = await supabase.rpc("update_event_full", {
          p_event_id: event.id,
          p_title: values.title,
          p_venue: values.venue || null,
          p_datetime: new Date(values.eventDatetime).toISOString(),
          p_description: values.description || null,
          p_response_deadline: new Date(values.responseDeadline).toISOString(),
          p_max_picks_per_guest: values.maxPicksPerGuest,
          p_menu_items: values.menuItems.map((item) => ({
            name: item.name,
            description: item.description || null,
            category: item.category || null,
          })),
        });
        if (error) {
          hideLoading();
          toast.error("Couldn't update event. Try again.");
          return;
        }
      }

      toast.success("Event updated.");
      router.push(`/dashboard/events/${event.id}`);
    },
    [event.id, mode, router, showLoading, hideLoading]
  );

  const arrayError =
    typeof errors.menuItems?.message === "string" ? errors.menuItems.message : null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      {/* Header */}
      <header
        className="border-b px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <span
          className="text-xl"
          style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
        >
          {APP_NAME}
        </span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* Page heading */}
        <div className="mb-6">
          <h1
            className="text-3xl"
            style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
          >
            Edit event
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Slug: <span className="font-mono">{event.slug}</span> (cannot be changed)
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-8"
        >
          {/* ── Event fields ── */}
          <div
            className="rounded-[16px] p-6 sm:p-8 space-y-5"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <h2 className="text-lg font-medium" style={{ color: "var(--text)" }}>
              Event details
            </h2>

            {/* Title */}
            <div>
              <Label htmlFor="title">
                Event title <span style={{ color: "#dc2626" }}>*</span>
              </Label>
              <input
                id="title"
                type="text"
                className={inputClass}
                style={inputStyle}
                {...register("title")}
              />
              <FieldError message={errors.title?.message} />
            </div>

            {/* Venue */}
            <div>
              <Label htmlFor="venue">Venue</Label>
              <input
                id="venue"
                type="text"
                className={inputClass}
                style={inputStyle}
                placeholder="Restaurant name or address"
                {...register("venue")}
              />
              <FieldError message={errors.venue?.message} />
            </div>

            {/* Event date & time */}
            <div>
              <Label htmlFor="eventDatetime">
                Event date &amp; time <span style={{ color: "#dc2626" }}>*</span>
              </Label>
              <input
                id="eventDatetime"
                type="datetime-local"
                className={inputClass}
                style={inputStyle}
                {...register("eventDatetime")}
              />
              <FieldError message={errors.eventDatetime?.message} />
            </div>

            {/* Response deadline */}
            <div>
              <Label htmlFor="responseDeadline">
                Response deadline <span style={{ color: "#dc2626" }}>*</span>
              </Label>
              <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>
                Guests cannot submit after this time
              </p>
              <input
                id="responseDeadline"
                type="datetime-local"
                className={inputClass}
                style={inputStyle}
                {...register("responseDeadline")}
              />
              <FieldError message={errors.responseDeadline?.message} />
              <TimezoneHint />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                rows={3}
                className={inputClass}
                style={inputStyle}
                {...register("description")}
              />
              <FieldError message={errors.description?.message} />
            </div>
          </div>

          {/* ── Menu items ── */}
          <div
            className="rounded-[16px] p-6 sm:p-8 space-y-4"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <h2 className="text-lg font-medium" style={{ color: "var(--text)" }}>
              Menu items
            </h2>

            {/* Max picks — shown in full mode only (locked when responses exist) */}
            {mode === "full" && (
              <div>
                <Label htmlFor="maxPicksPerGuest">
                  Max picks per guest <span style={{ color: "#dc2626" }}>*</span>
                </Label>
                <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>
                  How many items each guest can select — can&apos;t exceed the number of menu items
                </p>
                <input
                  id="maxPicksPerGuest"
                  type="number"
                  min={1}
                  max={10}
                  className={inputClass}
                  style={{ ...inputStyle, width: "6rem" }}
                  {...register("maxPicksPerGuest", { valueAsNumber: true })}
                />
                <FieldError message={errors.maxPicksPerGuest?.message} />
              </div>
            )}

            {mode === "metadata" ? (
              <>
                {/* Locked notice */}
                <div
                  className="rounded-[10px] p-4 text-sm"
                  style={{
                    backgroundColor: "#FEF3C7",
                    border: "1px solid #FDE68A",
                    color: "#92400E",
                  }}
                >
                  This event has {responseCount} response{responseCount === 1 ? "" : "s"}.
                  Menu items can&apos;t be changed once guests have responded. To change the
                  menu, close this event and create a new one.
                </div>

                {/* Read-only list */}
                <ol
                  className="rounded-[10px] divide-y"
                  style={{ backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}
                >
                  {menuItems.map((item, i) => (
                    <li key={i} className="px-4 py-2.5 text-sm flex gap-3 items-center">
                      <span className="font-medium" style={{ color: "var(--text)" }}>
                        {item.name}
                      </span>
                      {item.category && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: "var(--green-light)",
                            color: "var(--green-text)",
                          }}
                        >
                          {item.category}
                        </span>
                      )}
                      {item.description && (
                        <span style={{ color: "var(--muted)" }}>{item.description}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <>
                {/* Category management */}
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
                    Categories <span className="font-normal text-xs" style={{ color: "var(--muted)" }}>(optional)</span>
                  </p>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="e.g. Starters, Mains, Desserts"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCategory();
                        }
                      }}
                      className="w-full px-3 py-2.5 rounded-[10px] text-sm outline-none border transition-colors"
                      style={{ backgroundColor: "var(--bg)", borderColor: "var(--border-med)", color: "var(--text)" }}
                    />
                    <button
                      type="button"
                      onClick={addCategory}
                      className="px-4 py-2 rounded-[10px] text-sm font-medium flex-shrink-0 transition-colors"
                      style={{ backgroundColor: "var(--green-light)", color: "var(--green-text)", border: "1px solid var(--green-border)" }}
                    >
                      Add
                    </button>
                  </div>
                  {categories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => (
                        <span
                          key={cat}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm"
                          style={{ backgroundColor: "var(--green-light)", color: "var(--green-text)", border: "1px solid var(--green-border)" }}
                        >
                          {cat}
                          <button
                            type="button"
                            onClick={() => removeCategory(cat)}
                            aria-label={`Remove ${cat}`}
                            className="text-xs leading-none"
                            style={{ color: "var(--green-text)", opacity: 0.6 }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Drag rows to reorder. At least one item is required.
                </p>

                {arrayError && (
                  <p className="text-sm" style={{ color: "#dc2626" }} role="alert">
                    {arrayError}
                  </p>
                )}

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={fields.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {fields.map((field, index) => (
                        <MenuItemCard
                          key={field.id}
                          id={field.id}
                          index={index}
                          form={formAsCreate}
                          categories={categories}
                          onRemove={() => remove(index)}
                          nameRef={
                            index === fields.length - 1
                              ? (el) => {
                                  newRowRef.current = el;
                                }
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <button
                  type="button"
                  onClick={handleAdd}
                  className="w-full py-2.5 rounded-[10px] text-sm font-medium border-2 border-dashed transition-colors"
                  style={{
                    borderColor: "var(--green-border)",
                    color: "var(--green-text)",
                    backgroundColor: "transparent",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "var(--green-light)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  + Add menu item
                </button>
              </>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/events/${event.id}`)}
              className="px-5 py-2.5 rounded-[10px] text-sm font-medium border transition-colors"
              style={{ borderColor: "var(--border-med)", color: "var(--muted)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-[10px] text-sm font-medium text-white transition-opacity"
              style={{
                backgroundColor: "var(--green)",
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
