import { createAdminClient } from "@/lib/supabase/admin";

export async function checkCredits(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").select("credits").eq("id", userId).single();
  if (error) throw new Error(`Unable to read credits: ${error.message}`);
  return data?.credits ?? 0;
}

/**
 * Deducts `amount` credits from the user. Tries the atomic SQL function first,
 * falls back to a direct read+update if the function is missing.
 */
export async function deductCredits(userId: string, amount = 1) {
  if (amount <= 0) throw new Error("Credit amount must be positive");
  const admin = createAdminClient();

  // Try atomic function first
  const { data: rpcData, error: rpcError } = await admin.rpc("decrement_profile_credits", {
    p_user_id: userId,
    p_amount: amount,
  });

  if (!rpcError && typeof rpcData === "number" && rpcData >= 0) {
    return rpcData;
  }

  // Fallback: read-then-update
  if (rpcError) {
    console.warn("[credits] RPC decrement_profile_credits unavailable, using fallback:", rpcError.message);
  }

  const { data: profile, error: readError } = await admin
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();

  if (readError) throw new Error(`Unable to read credits: ${readError.message}`);
  const current = profile?.credits ?? 0;
  if (current < amount) throw new Error("Insufficient credits");

  const newCredits = current - amount;
  const { error: updateError } = await admin
    .from("profiles")
    .update({ credits: newCredits })
    .eq("id", userId);

  if (updateError) throw new Error(`Unable to deduct credits: ${updateError.message}`);
  return newCredits;
}

/**
 * Adds `amount` credits to the user. Tries the atomic SQL function first,
 * falls back to a direct read+update if the function is missing.
 */
export async function addCredits(userId: string, amount: number) {
  if (amount <= 0) throw new Error("Credit amount must be positive");
  const admin = createAdminClient();

  const { data: rpcData, error: rpcError } = await admin.rpc("add_profile_credits", {
    p_user_id: userId,
    p_amount: amount,
  });

  if (!rpcError && typeof rpcData === "number") {
    return rpcData;
  }

  if (rpcError) {
    console.warn("[credits] RPC add_profile_credits unavailable, using fallback:", rpcError.message);
  }

  const { data: profile, error: readError } = await admin
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();

  if (readError) throw new Error(`Unable to read credits: ${readError.message}`);
  const current = profile?.credits ?? 0;
  const newCredits = current + amount;

  const { error: updateError } = await admin
    .from("profiles")
    .update({ credits: newCredits })
    .eq("id", userId);

  if (updateError) throw new Error(`Unable to add credits: ${updateError.message}`);
  return newCredits;
}
