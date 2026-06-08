"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { submitResponse } from "@/app/actions/guest";
import { GUEST_NAME_MAX, NOTES_MAX } from "@/lib/schemas/guest";

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

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  sort_order: number;
};

type Props = {
  eventId: string;
  slug: string;
  maxPicksPerGuest: number;
  menuItems: MenuItem[];
};

function buildSchema(maxPicks: number) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, "Please enter your name")
      .max(GUEST_NAME_MAX, `Name must be ${GUEST_NAME_MAX} characters or fewer`),
    phone: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || /^(\+977)?[0-9]{10}$/.test(v.replace(/[\s-]/g, "")),
        { message: "Enter a valid Nepali number (10 digits, +977 optional)" }
      ),
    menuItemIds: z
      .array(z.string().uuid())
      .min(1, "Pick at least one dish")
      .max(maxPicks, `Select at most ${maxPicks} dish${maxPicks === 1 ? "" : "es"}`),
    notes: z
      .string()
      .trim()
      .max(NOTES_MAX, `Notes must be ${NOTES_MAX} characters or fewer`)
      .optional()
      .or(z.literal("")),
  });
}

// Infer from schema so the type is always consistent with validation.
type GuestFormValues = z.infer<ReturnType<typeof buildSchema>>;

export default function GuestForm({ eventId, slug, maxPicksPerGuest, menuItems }: Props) {
  const router = useRouter();

  const form = useForm<GuestFormValues>({
    resolver: zodResolver(buildSchema(maxPicksPerGuest)),
    defaultValues: { name: "", phone: "", menuItemIds: [], notes: "" },
    mode: "onTouched",
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const selectedIds = watch("menuItemIds") ?? [];
  const selectedCount = selectedIds.length;
  const atMax = selectedCount >= maxPicksPerGuest;

  function handleCheck(itemId: string, checked: boolean) {
    if (checked) {
      if (!atMax) {
        setValue("menuItemIds", [...selectedIds, itemId], { shouldValidate: true });
      }
    } else {
      setValue(
        "menuItemIds",
        selectedIds.filter((id) => id !== itemId),
        { shouldValidate: true }
      );
    }
  }

  const onSubmit = useCallback(
    async (values: GuestFormValues) => {
      const result = await submitResponse({
        eventId,
        guestName:  values.name.trim(),
        guestPhone: values.phone || null,
        notes:      values.notes || null,
        pickIds:    values.menuItemIds,
      });

      if (!result.ok) {
        if (result.errorKind === "rate_limited") {
          toast.error("You're submitting too quickly — please wait a minute and try again.");
        } else {
          toast.error("Couldn't submit your response. Try again or contact the host.");
        }
        return;
      }

      router.push(`/e/${slug}/thanks?t=${result.editToken}`);
    },
    [eventId, slug, router]
  );

  // Group items by category, preserving sort_order within each group.
  const hasCategories = menuItems.some((item) => item.category);
  const groups: { label: string | null; items: MenuItem[] }[] = [];
  if (hasCategories) {
    const seen = new Map<string, MenuItem[]>();
    for (const item of menuItems) {
      const key = item.category ?? "";
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(item);
    }
    for (const [label, items] of seen) {
      groups.push({ label: label || null, items });
    }
  } else {
    groups.push({ label: null, items: menuItems });
  }

  return (
    <>
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="max-w-xl mx-auto px-4 py-8 space-y-6 pb-24"
      >
        {/* Guest details */}
        <div
          className="rounded-[16px] p-6 space-y-5"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <h2 className="text-base font-medium" style={{ color: "var(--text)" }}>
            Your details
          </h2>

          {/* Name */}
          <div>
            <Label htmlFor="name">
              Your name <span style={{ color: "#dc2626" }}>*</span>
            </Label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              className={inputClass}
              style={inputStyle}
              placeholder="e.g. Priya Sharma"
              {...register("name")}
            />
            <FieldError message={errors.name?.message} />
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="phone">Phone number</Label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className={inputClass}
              style={inputStyle}
              placeholder="+977 9812345678 or 9812345678"
              {...register("phone")}
            />
            <FieldError message={errors.phone?.message} />
          </div>
        </div>

        {/* Menu picks */}
        <div
          className="rounded-[16px] p-6 space-y-4"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-medium" style={{ color: "var(--text)" }}>
              Your picks
            </h2>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              Choose up to {maxPicksPerGuest}
            </span>
          </div>

          {errors.menuItemIds && (
            <p className="text-sm" style={{ color: "#dc2626" }} role="alert">
              {errors.menuItemIds.message}
            </p>
          )}

          <div className="space-y-4">
            {groups.map((group, gi) => (
              <div key={gi}>
                {group.label && (
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "var(--subtle)" }}
                  >
                    {group.label}
                  </p>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const checked = selectedIds.includes(item.id);
                    const disabled = atMax && !checked;
                    return (
                      <label
                        key={item.id}
                        className="flex items-start gap-3 rounded-[10px] px-3 py-3 cursor-pointer transition-colors"
                        style={{
                          backgroundColor: checked ? "var(--green-light)" : "var(--bg)",
                          border: `1px solid ${checked ? "var(--green-border)" : "var(--border)"}`,
                          opacity: disabled ? 0.45 : 1,
                          cursor: disabled ? "not-allowed" : "pointer",
                        }}
                        aria-disabled={disabled}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 flex-shrink-0 accent-green-600"
                          style={{ accentColor: "var(--green)" }}
                          checked={checked}
                          disabled={disabled}
                          onChange={(e) => handleCheck(item.id, e.target.checked)}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium leading-snug"
                            style={{ color: "var(--text)" }}
                          >
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                              {item.description}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div
          className="rounded-[16px] p-6"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Label htmlFor="notes">Notes for the host</Label>
          <textarea
            id="notes"
            rows={3}
            className={inputClass}
            style={inputStyle}
            placeholder="Allergies, preferences, anything the host should know."
            {...register("notes")}
          />
          <FieldError message={errors.notes?.message} />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-[10px] text-sm font-medium text-white transition-opacity"
          style={{
            backgroundColor: "var(--green)",
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          {isSubmitting ? "Submitting…" : "Submit my picks"}
        </button>
      </form>

      {/* Sticky pick counter */}
      <div
        className="fixed bottom-0 left-0 right-0 z-10 border-t px-4 py-3 flex items-center justify-between"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
          {selectedCount} of {maxPicksPerGuest} selected
        </span>
        {atMax && (
          <span
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ backgroundColor: "var(--green-light)", color: "var(--green-text)" }}
          >
            Max reached
          </span>
        )}
      </div>
    </>
  );
}
