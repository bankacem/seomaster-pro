import { createAdminClient } from "@/lib/supabase/admin";

export async function checkCredits(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").select("credits").eq("id", userId).single();
  if (error) throw new Error(`Unable to read credits: ${error.message}`);
  return data.credits;
}

export async function deductCredits(userId: string, amount = 1) {
  if (amount <= 0) throw new Error("Credit amount must be positive");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("decrement_profile_credits", { p_user_id: userId, p_amount: amount });
  if (error) throw new Error(`Unable to deduct credits: ${error.message}`);
  if (data === null || data < 0) throw new Error("Insufficient credits");
  return data;
}

export async function addCredits(userId: string, amount: number) {
  if (amount <= 0) throw new Error("Credit amount must be positive");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("add_profile_credits", { p_user_id: userId, p_amount: amount });
  if (error) throw new Error(`Unable to add credits: ${error.message}`);
  return data;
}