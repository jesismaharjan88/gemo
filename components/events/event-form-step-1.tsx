import type { UseFormReturn } from "react-hook-form";
import type { EventFormValues } from "@/lib/schemas/event";
import TimezoneHint from "@/components/timezone-hint";

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

const inputClass =
  "w-full px-3 py-2.5 rounded-[10px] text-sm outline-none border transition-colors";
const inputStyle = {
  backgroundColor: "var(--bg)",
  borderColor: "var(--border-med)",
  color: "var(--text)",
};

export default function EventFormStep1({ form }: { form: UseFormReturn<EventFormValues> }) {
  const { register, formState: { errors } } = form;

  return (
    <div className="space-y-5">
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
          placeholder="e.g. Jes's Birthday Lunch"
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
          placeholder="e.g. Lunch is on me — pick whatever you like!"
          {...register("description")}
        />
        <FieldError message={errors.description?.message} />
      </div>
    </div>
  );
}
