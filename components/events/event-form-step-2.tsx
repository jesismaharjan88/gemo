"use client";

import { useRef, useState } from "react";
import { useFieldArray, type UseFormReturn } from "react-hook-form";
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
} from "@dnd-kit/sortable";
import type { EventFormValues } from "@/lib/schemas/event";
import MenuItemCard from "./menu-item-card";

const inputClass =
  "px-3 py-2.5 rounded-[10px] text-sm outline-none border transition-colors";
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
    <label htmlFor={htmlFor} className="block text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
      {children}
    </label>
  );
}

export default function EventFormStep2({ form }: { form: UseFormReturn<EventFormValues> }) {
  const { register, control, formState: { errors }, watch } = form;
  const maxPicks = watch("maxPicksPerGuest");
  const { fields, append, remove, move } = useFieldArray({ control, name: "menuItems" });
  const newRowRef = useRef<HTMLInputElement | null>(null);

  // Initialize categories from any existing item values (handles draft restore / navigating back)
  const [categories, setCategories] = useState<string[]>(() => {
    const items = form.getValues("menuItems");
    const seen = new Set<string>();
    const cats: string[] = [];
    for (const item of items) {
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
    // Clear this category from any items that have it assigned
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) move(oldIndex, newIndex);
  }

  function handleAdd() {
    append({ name: "", description: "", category: "" });
    requestAnimationFrame(() => newRowRef.current?.focus());
  }

  const arrayError =
    typeof errors.menuItems?.message === "string" ? errors.menuItems.message : null;

  return (
    <div className="space-y-6">
      {/* Max picks per guest */}
      <div>
        <Label htmlFor="maxPicksPerGuest">
          Max picks per guest <span style={{ color: "#dc2626" }}>*</span>
        </Label>
        <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>
          How many items each guest can select — can&apos;t exceed the number of menu items below
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
        {fields.length > 0 && !errors.maxPicksPerGuest && (
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            {maxPicks} of {fields.length} item{fields.length === 1 ? "" : "s"}
          </p>
        )}
        <FieldError message={errors.maxPicksPerGuest?.message} />
      </div>

      {/* Categories */}
      <div>
        <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
          Categories <span className="font-normal text-xs" style={{ color: "var(--muted)" }}>(optional)</span>
        </p>
        <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
          Define categories first, then assign items to them below
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
            className={inputClass}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={addCategory}
            className="px-4 py-2 rounded-[10px] text-sm font-medium flex-shrink-0 transition-colors"
            style={{
              backgroundColor: "var(--green-light)",
              color: "var(--green-text)",
              border: "1px solid var(--green-border)",
            }}
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
                style={{
                  backgroundColor: "var(--green-light)",
                  color: "var(--green-text)",
                  border: "1px solid var(--green-border)",
                }}
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

      {/* Menu items */}
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Drag rows to reorder. At least one item is required.
        </p>

        {arrayError && (
          <p className="text-sm" style={{ color: "#dc2626" }} role="alert">
            {arrayError}
          </p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {fields.map((field, index) => (
                <MenuItemCard
                  key={field.id}
                  id={field.id}
                  index={index}
                  form={form}
                  categories={categories}
                  onRemove={() => remove(index)}
                  nameRef={index === fields.length - 1 ? (el) => { newRowRef.current = el; } : undefined}
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
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--green-light)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          + Add menu item
        </button>
      </div>
    </div>
  );
}
