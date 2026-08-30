import { supabase, hasSupabasePublicEnv } from "./client";

const VOTER_ID_KEY = "astrosyo:calc-voter-id";

/**
 * Returns a stable anonymous id for this browser, generating and
 * persisting one in localStorage on first use. This is the only "identity"
 * anonymous voters have — it lets the backend enforce one active vote per
 * calculator per browser without any account.
 */
export function getVoterId() {
  if (typeof window === "undefined") return null;

  try {
    const existing = window.localStorage.getItem(VOTER_ID_KEY);
    if (existing) return existing;

    const fresh = crypto.randomUUID();
    window.localStorage.setItem(VOTER_ID_KEY, fresh);
    return fresh;
  } catch (_err) {
    // localStorage unavailable (private mode, blocked storage, etc). Fall
    // back to an in-memory id so voting still works for this page view.
    return crypto.randomUUID();
  }
}

/**
 * Fetches the current thumbs up/down tally for a calculator, plus this
 * browser's own vote if any (1 = up, -1 = down, null = no vote).
 */
export async function getCalculatorVotes(slug) {
  if (!hasSupabasePublicEnv || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const voterId = getVoterId();

  const { data, error } = await supabase.rpc("get_calculator_votes", {
    p_slug: slug,
    p_voter_id: voterId,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    thumbsUp: Number(row?.thumbs_up ?? 0),
    thumbsDown: Number(row?.thumbs_down ?? 0),
    myVote: row?.my_vote ?? null,
  };
}

/**
 * Casts a vote (1 = up, -1 = down). Clicking the same choice again toggles
 * the vote off; clicking the other choice switches it. Returns the fresh
 * tally the same shape as getCalculatorVotes.
 */
export async function castCalculatorVote(slug, voteType) {
  if (!hasSupabasePublicEnv || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const voterId = getVoterId();

  const { data, error } = await supabase.rpc("cast_calculator_vote", {
    p_slug: slug,
    p_voter_id: voterId,
    p_vote_type: voteType,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    thumbsUp: Number(row?.thumbs_up ?? 0),
    thumbsDown: Number(row?.thumbs_down ?? 0),
    myVote: row?.my_vote ?? null,
  };
}
