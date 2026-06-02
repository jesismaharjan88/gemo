"use client";

import { useRef } from "react";
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
  arrayMove,
} from "@dnd-kit/sortable";
import type { EventFormValues } from "@/lib/schemas/event";
import MenuItemCard from "./menu-item-card";

export default function EventFormStep2({ form }: { form: UseFormReturn<EventFormValues> }) {
  const { control, formState: { errors } } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "menuItems" });

  // Refs for focusing newly added rows
  const newRowRef = useRef<HTMLInputElement | null>(null);

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
    // Focus happens via the ref callback on the newly mounted card
    requestAnimationFrame(() => newRowRef.current?.focus());
  }

  const arrayError =
    typeof errors.menuItems?.message === "string" ? errors.menuItems.message : null;

  return (
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
  );
}
