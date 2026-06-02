import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { UseFormReturn } from "react-hook-form";
import type { EventFormValues } from "@/lib/schemas/event";

const inputClass = "w-full px-3 py-2 rounded-[10px] text-sm outline-none border transition-colors";
const inputStyle = {
  backgroundColor: "var(--bg)",
  borderColor: "var(--border-med)",
  color: "var(--text)",
};

function GripIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      style={{ color: "var(--subtle)" }}
    >
      <circle cx="5" cy="4" r="1.2" />
      <circle cx="11" cy="4" r="1.2" />
      <circle cx="5" cy="8" r="1.2" />
      <circle cx="11" cy="8" r="1.2" />
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="11" cy="12" r="1.2" />
    </svg>
  );
}

export default function MenuItemCard({
  id,
  index,
  form,
  onRemove,
  nameRef,
}: {
  id: string;
  index: number;
  form: UseFormReturn<EventFormValues>;
  onRemove: () => void;
  nameRef?: (el: HTMLInputElement | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { register, formState: { errors } } = form;
  const itemErrors = errors.menuItems?.[index];

  const { ref: rhfRef, ...nameRest } = register(`menuItems.${index}.name`);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
      className="rounded-[10px] p-3 flex gap-2 items-start"
    >
      {/* Drag handle — only this element gets dnd listeners */}
      <button
        type="button"
        className="mt-2.5 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>

      <div className="flex-1 space-y-2">
        <div>
          <input
            type="text"
            placeholder="Item name *"
            className={inputClass}
            style={inputStyle}
            {...nameRest}
            ref={(el) => {
              rhfRef(el);
              nameRef?.(el);
            }}
          />
          {itemErrors?.name && (
            <p className="mt-1 text-xs" style={{ color: "#dc2626" }} role="alert">
              {itemErrors.name.message}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Description (optional)"
            className={inputClass}
            style={inputStyle}
            {...register(`menuItems.${index}.description`)}
          />
          <input
            type="text"
            placeholder="Category"
            className={`${inputClass} w-36 flex-shrink-0`}
            style={inputStyle}
            {...register(`menuItems.${index}.category`)}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove item"
        className="mt-2 flex-shrink-0 text-sm px-2 py-1 rounded-[6px] transition-colors"
        style={{ color: "var(--muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
      >
        ✕
      </button>
    </div>
  );
}
