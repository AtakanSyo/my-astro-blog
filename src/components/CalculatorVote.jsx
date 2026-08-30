import { useEffect, useState } from "react";
import { hasSupabasePublicEnv } from "../lib/supabase/client";
import { getCalculatorVotes, castCalculatorVote } from "../lib/supabase/calculatorVotes";
import "../styles/calculatorVote.css";

/**
 * Anonymous thumbs up / thumbs down widget for a calculator page. No
 * account needed to vote — each browser gets one vote per calculator,
 * tracked via a local voter id (see lib/supabase/calculatorVotes.js).
 *
 * @param {{ slug: string }} props
 */
export default function CalculatorVote({ slug }) {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [thumbsUp, setThumbsUp] = useState(0);
  const [thumbsDown, setThumbsDown] = useState(0);
  const [myVote, setMyVote] = useState(null);

  useEffect(() => {
    if (!slug || !hasSupabasePublicEnv) {
      setLoading(false);
      return;
    }

    let mounted = true;

    getCalculatorVotes(slug)
      .then((result) => {
        if (!mounted) return;
        setThumbsUp(result.thumbsUp);
        setThumbsDown(result.thumbsDown);
        setMyVote(result.myVote);
      })
      .catch(() => {
        if (mounted) setError("Could not load votes.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [slug]);

  async function handleVote(voteType) {
    if (pending || !slug) return;

    const prevUp = thumbsUp;
    const prevDown = thumbsDown;
    const prevVote = myVote;

    // Optimistic update so the click feels instant.
    let nextUp = thumbsUp;
    let nextDown = thumbsDown;
    if (prevVote === voteType) {
      // toggling off
      if (voteType === 1) nextUp -= 1;
      else nextDown -= 1;
      setMyVote(null);
    } else {
      if (prevVote === 1) nextUp -= 1;
      if (prevVote === -1) nextDown -= 1;
      if (voteType === 1) nextUp += 1;
      else nextDown += 1;
      setMyVote(voteType);
    }
    setThumbsUp(nextUp);
    setThumbsDown(nextDown);
    setError("");
    setPending(true);

    try {
      const result = await castCalculatorVote(slug, voteType);
      setThumbsUp(result.thumbsUp);
      setThumbsDown(result.thumbsDown);
      setMyVote(result.myVote);
    } catch (_err) {
      // Roll back on failure.
      setThumbsUp(prevUp);
      setThumbsDown(prevDown);
      setMyVote(prevVote);
      setError("Could not save your vote. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (!hasSupabasePublicEnv || (error && loading)) return null;

  return (
    <div className="calc-vote" aria-busy={loading}>
      <span className="calc-vote-label">Was this calculator helpful?</span>
      <div className="calc-vote-buttons">
        <button
          type="button"
          className={`calc-vote-btn${myVote === 1 ? " is-active" : ""}`}
          onClick={() => handleVote(1)}
          disabled={loading || pending}
          aria-pressed={myVote === 1}
          aria-label="Thumbs up"
        >
          <span className="calc-vote-icon" aria-hidden="true">👍</span>
          <span className="calc-vote-count">{loading ? "–" : thumbsUp}</span>
        </button>
        <button
          type="button"
          className={`calc-vote-btn${myVote === -1 ? " is-active" : ""}`}
          onClick={() => handleVote(-1)}
          disabled={loading || pending}
          aria-pressed={myVote === -1}
          aria-label="Thumbs down"
        >
          <span className="calc-vote-icon" aria-hidden="true">👎</span>
          <span className="calc-vote-count">{loading ? "–" : thumbsDown}</span>
        </button>
      </div>
      {error && <span className="calc-vote-error" aria-live="polite">{error}</span>}
    </div>
  );
}
