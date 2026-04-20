import { useEffect, useMemo, useState } from "react";
import { hasSupabasePublicEnv, supabase } from "../lib/supabase/client";

const INITIAL_LOAD_TIMEOUT_MS = 8000;

function formatScore(value, digits = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return value.toFixed(digits);
}

function scoreToHue(score) {
  if (typeof score !== "number" || Number.isNaN(score)) return 210;
  return Math.round((Math.max(0, Math.min(10, score)) / 10) * 120);
}

/**
 * @param {{ slug: string, editorialScore?: number | null }} props
 */
export default function ReviewUserRating(props) {
  const { slug, editorialScore = null } = props;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [session, setSession] = useState(null);
  const [telescope, setTelescope] = useState(null);
  const [myRating, setMyRating] = useState(null);
  const [draftRating, setDraftRating] = useState(8);
  const [reloadKey, setReloadKey] = useState(0);

  const isSignedIn = Boolean(session?.user);
  const communityScore = telescope?.user_rating ?? 0;
  const communityCount = telescope?.user_rating_count ?? 0;
  const editorialHue = scoreToHue(editorialScore);
  const readerHue = scoreToHue(communityScore);
  const draftHue = scoreToHue(draftRating);

  const hasTelescope = Boolean(telescope?.id);

  const authLabel = useMemo(() => {
    if (!isSignedIn) return "";
    return myRating ? `Your rating: ${formatScore(myRating, 1)}/10` : "Rate this telescope";
  }, [isSignedIn, myRating]);

  async function loadData(currentSession = null) {
    if (!supabase) return;

    const activeSession = currentSession ?? session;
    const userId = activeSession?.user?.id;

    setError("");
    setMessage("");

    const { data: telescopeData, error: telescopeError } = await supabase
      .from("telescopes")
      .select("id, user_rating, user_rating_count, editorial_rating, slug")
      .eq("slug", slug)
      .maybeSingle();

    if (telescopeError) {
      setError("Could not load community ratings right now.");
      setTelescope(null);
      setMyRating(null);
      return;
    }

    if (!telescopeData) {
      setError("Community ratings are not enabled for this review yet.");
      setTelescope(null);
      setMyRating(null);
      return;
    }

    setTelescope(telescopeData);

    if (!userId) {
      setMyRating(null);
      setDraftRating(8);
      return;
    }

    const { data: userRatingData, error: userRatingError } = await supabase
      .from("telescope_user_ratings")
      .select("rating")
      .eq("telescope_id", telescopeData.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (userRatingError) {
      setError("Could not load your rating.");
      return;
    }

    const existing = userRatingData?.rating ?? null;
    setMyRating(existing);
    setDraftRating(existing ?? 8);
  }

  useEffect(() => {
    if (!hasSupabasePublicEnv || !supabase) {
      setError("Ratings are unavailable because Supabase is not configured.");
      setLoading(false);
      return;
    }

    let mounted = true;
    let timeoutId;

    async function boot() {
      setLoading(true);
      setError("");
      setMessage("");

      timeoutId = setTimeout(() => {
        if (!mounted) return;
        setError("Loading ratings timed out. Please try again.");
        setLoading(false);
      }, INITIAL_LOAD_TIMEOUT_MS);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!mounted) return;

        const currentSession = sessionData.session ?? null;
        setSession(currentSession);
        await loadData(currentSession);
      } catch (_err) {
        if (!mounted) return;
        setError("Could not load ratings right now.");
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (mounted) setLoading(false);
      }
    }

    boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession ?? null);
      await loadData(nextSession ?? null);
    });

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [slug, reloadKey]);

  async function handleRateSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isSignedIn) {
      setShowSignInModal(true);
      return;
    }

    if (!hasTelescope || !session?.user?.id || !supabase) {
      setError("This telescope cannot be rated yet.");
      return;
    }

    setSaving(true);

    try {
      const { error: upsertError } = await supabase
        .from("telescope_user_ratings")
        .upsert(
          {
            telescope_id: telescope.id,
            user_id: session.user.id,
            rating: Number(draftRating),
          },
          { onConflict: "telescope_id,user_id" }
        );

      if (upsertError) {
        setError(upsertError.message || "Could not submit your rating.");
        return;
      }

      setMessage("Thanks. Your rating has been saved.");
      setMyRating(Number(draftRating));

      // Refresh aggregates in the background so UI never gets stuck in "Saving...".
      loadData(session).catch(() => {
        setError("Rating saved, but refreshing community stats failed. Try reloading the page.");
      });
    } catch (_err) {
      setError("Could not submit your rating. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="user-rating-card" aria-busy="true">
        <h3>Ratings</h3>
        <p>Loading ratings...</p>
      </section>
    );
  }

  return (
    <>
      <section className="user-rating-card">
        <h3>Ratings</h3>

        <div className="user-rating-stats">
          <div className="user-rating-stat" style={{ "--h": editorialHue }}>
            <span className="label">Editorial</span>
            <span className="value">{formatScore(editorialScore, 1)}/10</span>
          </div>
          <div className="user-rating-stat" style={{ "--h": readerHue }}>
            <span className="label">Readers</span>
            <span className="value">
              {formatScore(communityScore, 2)}/10
              <small>({communityCount} votes)</small>
            </span>
          </div>
        </div>

        <form className="user-rating-form" onSubmit={handleRateSubmit}>
          {authLabel && <label htmlFor={`rating-${slug}`}>{authLabel}</label>}
          <div className="user-rating-input-row">
            <input
              id={`rating-${slug}`}
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={draftRating}
              onChange={(event) => setDraftRating(Number(event.target.value))}
              disabled={!hasTelescope || saving}
              aria-label={authLabel || "Rating slider"}
            />
            <span className="user-rating-current" style={{ "--h": draftHue }}>
              {formatScore(draftRating, 1)}
            </span>
          </div>
          <button type="submit" disabled={!hasTelescope || saving}>
            {isSignedIn ? (saving ? "Saving..." : "Submit rating") : "Sign in to rate"}
          </button>
        </form>

        {message && (
          <p className="user-rating-message" aria-live="polite">
            {message}
          </p>
        )}
        {error && (
          <p className="user-rating-error" aria-live="polite">
            {error}
          </p>
        )}
        {error && !saving && (
          <button
            type="button"
            className="user-rating-retry"
            onClick={() => setReloadKey((prev) => prev + 1)}
          >
            Retry
          </button>
        )}
      </section>

      {showSignInModal && (
        <div className="signin-modal-overlay" role="presentation" onClick={() => setShowSignInModal(false)}>
          <div
            className="signin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Sign in required"
            onClick={(event) => event.stopPropagation()}
          >
            <h4>Sign in required</h4>
            <p>You need an account to submit a telescope rating.</p>
            <div className="signin-modal-actions">
              <a href="/account">Sign in</a>
              <button type="button" onClick={() => setShowSignInModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
