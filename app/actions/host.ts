"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { error?: string };

export async function updateHostProfile(
  _prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const name = (formData.get("name") as string | null) ?? "";
  const next = (formData.get("next") as string | null) || "/dashboard";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase.rpc("update_host_profile", { p_name: name });

  if (error) {
    const isNameError =
      error.message.includes("invalid_name") ||
      error.message.includes("empty") ||
      error.message.includes("100");
    return {
      error: isNameError
        ? "Name must be between 1 and 100 characters."
        : "Something went wrong. Please try again.",
    };
  }

  redirect(next);
}
