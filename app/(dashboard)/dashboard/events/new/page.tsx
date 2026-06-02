"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { eventFormSchema, type EventFormValues, STEP_1_FIELDS, STEP_2_FIELDS } from "@/lib/schemas/event";
import { generateSlug } from "@/lib/utils/slug";
import { mapRpcError } from "@/lib/errors";
import { APP_NAME } from "@/lib/constants";
import StepIndicator from "@/components/events/step-indicator";
import EventFormStep1 from "@/components/events/event-form-step-1";
import EventFormStep2 from "@/components/events/event-form-step-2";
import { useState } from "react";

const DRAFT_KEY = "gemo.event-draft-v1";

const DEFAULT_VALUES: EventFormValues = {
  title: "",
  venue: "",
  eventDatetime: "",
  description: "",
  maxPicksPerGuest: 3,
  responseDeadline: "",
  menuItems: [{ name: "", description: "", category: "" }],
};

function formatDateForReview(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function NewEventPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasHydrated = useRef(false);
  const discardingRef = useRef(false);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
  });

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    if (hasHydrated.current) return;
    hasHydrated.current = true;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { values: EventFormValues; step: 1 | 2 | 3 };
      if (parsed.values) form.reset(parsed.values);
      if (parsed.step) setCurrentStep(parsed.step);
    } catch {
      // corrupt storage — ignore
    }
  }, [form]);

  // Persist to sessionStorage on every form change
  const saveDraft = useCallback(
    (values: EventFormValues) => {
      if (discardingRef.current) return;
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ values, step: currentStep }));
      } catch {
        // storage quota exceeded — ignore
      }
    },
    [currentStep]
  );

  useEffect(() => {
    const sub = form.watch((values) => saveDraft(values as EventFormValues));
    return () => sub.unsubscribe();
  }, [form, saveDraft]);

  function discardDraft() {
    discardingRef.current = true;
    sessionStorage.removeItem(DRAFT_KEY);
    // Navigate first — this is the visible action the user expects.
    // The reset keeps the form clean if the router is slow or the user hits Back.
    form.reset(DEFAULT_VALUES);
    router.push("/dashboard");
  }

  async function goNext() {
    if (currentStep === 1) {
      const ok = await form.trigger([...STEP_1_FIELDS]);
      if (ok) setCurrentStep(2);
    } else if (currentStep === 2) {
      const ok = await form.trigger([...STEP_2_FIELDS]);
      if (ok) setCurrentStep(3);
    }
  }

  function goBack() {
    setCurrentStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
  }

  // Which step contains a given RHF field name?
  function stepForField(field: string): 1 | 2 | 3 {
    if ((STEP_1_FIELDS as readonly string[]).includes(field)) return 1;
    if (field.startsWith("menuItems")) return 2;
    return 3;
  }

  async function submit(status: "active" | "draft") {
    const valid = await form.trigger();
    if (!valid) {
      // Jump to the first step that has errors
      const errFields = Object.keys(form.formState.errors);
      if (errFields.length > 0) setCurrentStep(stepForField(errFields[0]));
      return;
    }

    setIsSubmitting(true);
    const values = form.getValues();
    const slug = generateSlug(values.title);

    const payload = {
      p_title: values.title,
      p_slug: slug,
      p_venue: values.venue || null,
      p_event_datetime: new Date(values.eventDatetime).toISOString(),
      p_description: values.description || null,
      p_max_picks_per_guest: values.maxPicksPerGuest,
      p_response_deadline: new Date(values.responseDeadline).toISOString(),
      p_status: status,
      p_menu_items: values.menuItems.map((item) => ({
        name: item.name,
        description: item.description || null,
        category: item.category || null,
      })),
    };

    const supabase = createClient();
    let { data, error } = await supabase.rpc("create_event_with_items", payload);

    // One retry on slug collision (23505 = unique_violation)
    if (error && (error as any).code === "23505") {
      const retrySlug = generateSlug(values.title);
      ({ data, error } = await supabase.rpc("create_event_with_items", {
        ...payload,
        p_slug: retrySlug,
      }));
    }

    setIsSubmitting(false);

    if (error) {
      const mapped = mapRpcError(error);
      if (mapped.redirect) {
        toast.error(mapped.message);
        router.push(mapped.redirect);
        return;
      }
      toast.error(mapped.message);
      if (mapped.field) {
        const field = mapped.field as Parameters<typeof form.setError>[0];
        form.setError(field, { message: mapped.message });
        setCurrentStep(stepForField(mapped.field));
      }
      return;
    }

    sessionStorage.removeItem(DRAFT_KEY);
    toast.success(status === "active" ? "Event published!" : "Saved as draft.");
    router.push("/dashboard");
  }

  const values = form.watch();

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
        <button
          type="button"
          onClick={discardDraft}
          className="text-sm px-3 py-1.5 rounded-[8px] transition-colors"
          style={{ color: "var(--muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
        >
          Discard draft
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* Page heading + step indicator */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1
            className="text-3xl"
            style={{ fontFamily: "var(--font-dm-serif)", color: "var(--text)" }}
          >
            Create event
          </h1>
          <StepIndicator current={currentStep} />
        </div>

        <div
          className="rounded-[16px] p-6 sm:p-8"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {/* ── Step 1 ── */}
          {currentStep === 1 && (
            <>
              <h2 className="text-lg font-medium mb-6" style={{ color: "var(--text)" }}>
                Event details
              </h2>
              <EventFormStep1 form={form} />
            </>
          )}

          {/* ── Step 2 ── */}
          {currentStep === 2 && (
            <>
              <h2 className="text-lg font-medium mb-6" style={{ color: "var(--text)" }}>
                Menu items
              </h2>
              <EventFormStep2 form={form} />
            </>
          )}

          {/* ── Step 3: Review ── */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-medium" style={{ color: "var(--text)" }}>
                Review &amp; publish
              </h2>

              {/* Details summary */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                    Details
                  </h3>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-sm"
                    style={{ color: "var(--green)" }}
                  >
                    Edit
                  </button>
                </div>
                <dl
                  className="rounded-[10px] p-4 space-y-2"
                  style={{ backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}
                >
                  {[
                    ["Title", values.title],
                    ["Venue", values.venue || "—"],
                    ["Event date", formatDateForReview(values.eventDatetime)],
                    ["Deadline", formatDateForReview(values.responseDeadline)],
                    ["Max picks", String(values.maxPicksPerGuest)],
                    ["Description", values.description || "—"],
                  ].map(([label, val]) => (
                    <div key={label} className="flex gap-4 text-sm">
                      <dt className="w-28 flex-shrink-0" style={{ color: "var(--muted)" }}>{label}</dt>
                      <dd style={{ color: "var(--text)" }}>{val}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {/* Menu summary */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                    Menu ({values.menuItems.length} {values.menuItems.length === 1 ? "item" : "items"})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-sm"
                    style={{ color: "var(--green)" }}
                  >
                    Edit
                  </button>
                </div>
                <ol
                  className="rounded-[10px] divide-y"
                  style={{ backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}
                >
                  {values.menuItems.map((item, i) => (
                    <li key={i} className="px-4 py-2.5 text-sm flex gap-3">
                      <span className="font-medium" style={{ color: "var(--text)" }}>{item.name}</span>
                      {item.category && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full self-center"
                          style={{ backgroundColor: "var(--green-light)", color: "var(--green-text)" }}
                        >
                          {item.category}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          )}

          {/* ── Navigation buttons ── */}
          <div className="mt-8 flex items-center justify-between gap-3">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={goBack}
                className="px-5 py-2.5 rounded-[10px] text-sm font-medium border transition-colors"
                style={{ borderColor: "var(--border-med)", color: "var(--muted)" }}
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={goNext}
                className="px-6 py-2.5 rounded-[10px] text-sm font-medium transition-opacity"
                style={{ backgroundColor: "var(--green)", color: "#fff" }}
              >
                Next
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submit("draft")}
                  className="px-5 py-2.5 rounded-[10px] text-sm font-medium border transition-opacity"
                  style={{
                    borderColor: "var(--border-med)",
                    color: "var(--muted)",
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                >
                  Save as draft
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => submit("active")}
                  className="px-6 py-2.5 rounded-[10px] text-sm font-medium transition-opacity"
                  style={{
                    backgroundColor: "var(--green)",
                    color: "#fff",
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                >
                  {isSubmitting ? "Publishing…" : "Publish"}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
