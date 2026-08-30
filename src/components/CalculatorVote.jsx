import { useEffect, useRef, useState } from "react";
import { hasSupabasePublicEnv } from "../lib/supabase/client";
import { getCalculatorVotes, castCalculatorVote, DOWN_VOTE_REASONS } from "../lib/supabase/calculatorVotes";
import "../styles/calculatorVote.css";

/**
 * Compact anonymous thumbs up / thumbs down widget, meant to sit inline
 * next to a calculator's "Copy shareable link" button. No account needed
 * to vote — each browser gets one vote per calculator, tracked via a
 * local voter id (see lib/supabase/calculatorVotes.js).
 *
 * A thumbs-down requires picking a reason first: clicking it opens a menu
 * (wrong answer / confusing / missing feature / broken / other) and the
 * vote isn't cast until one is chosen. Clicking thumbs-down again while
 * already down-voted just toggles the vote off, same as thumbs-up.
 *
 * @param {{ slug: string }} props
 */
export default function CalculatorVote({ slug }) {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [thumbsUp, setThumbsUp] = useState(0);
  const [thumbsDown, setThumbsDown] = useState(0);
  const [myVote, setMyVote] = useState(null);
  const [myDownReason, setMyDownReason] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef(null);

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
        setMyDownReason(result.myDownReason);
      })
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [slug]);

  // Close the reason menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  async function submitVote(voteType, downReason = null) {
    if (pending || !slug) return;

    const prevUp = thumbsUp;
    const prevDown = thumbsDown;
    const prevVote = myVote;
    const prevDownReason = myDownReason;

    // Optimistic update so the click feels instant.
    let nextUp = thumbsUp;
    let nextDown = thumbsDown;
    if (prevVote === voteType) {
      // toggling off
      if (voteType === 1) nextUp -= 1;
      else nextDown -= 1;
      setMyVote(null);
      setMyDownReason(null);
    } else {
      if (prevVote === 1) nextUp -= 1;
      if (prevVote === -1) nextDown -= 1;
      if (voteType === 1) nextUp += 1;
      else nextDown += 1;
      setMyVote(voteType);
      setMyDownReason(voteType === -1 ? downReason : null);
    }
    setThumbsUp(nextUp);
    setThumbsDown(nextDown);
    setError(false);
    setPending(true);

    try {
      const result = await castCalculatorVote(slug, voteType, downReason);
      setThumbsUp(result.thumbsUp);
      setThumbsDown(result.thumbsDown);
      setMyVote(result.myVote);
      setMyDownReason(result.myDownReason);
    } catch (_err) {
      // Roll back on failure.
      setThumbsUp(prevUp);
      setThumbsDown(prevDown);
      setMyVote(prevVote);
      setMyDownReason(prevDownReason);
      setError(true);
    } finally {
      setPending(false);
    }
  }

  function handleThumbsUpClick() {
    setMenuOpen(false);
    submitVote(1);
  }

  function handleThumbsDownClick() {
    if (pending) return;
    if (myVote === -1) {
      // Already down-voted — clicking again just removes the vote.
      submitVote(-1);
      return;
    }
    // New down-vote: a reason is required before anything is submitted.
    setMenuOpen((open) => !open);
  }

  function handleReasonSelect(reasonValue) {
    setMenuOpen(false);
    submitVote(-1, reasonValue);
  }

  if (!hasSupabasePublicEnv) return null;

  const downReasonLabel = DOWN_VOTE_REASONS.find((r) => r.value === myDownReason)?.label;

  return (
    <div className="calc-vote" role="group" aria-label="Rate this calculator" aria-busy={loading}>
      <span className="calc-vote-label">Was this helpful?</span>
      <button
        type="button"
        className={`calc-vote-btn${myVote === 1 ? " is-active" : ""}`}
        onClick={handleThumbsUpClick}
        disabled={loading || pending}
        aria-pressed={myVote === 1}
        aria-label="Thumbs up"
        title="Thumbs up"
      >
        <span className="calc-vote-icon" aria-hidden="true">👍</span>
        <span className="calc-vote-count">Yes</span>
      </button>

      <div className="calc-vote-down-wrap" ref={wrapRef}>
        <button
          type="button"
          className={`calc-vote-btn${myVote === -1 ? " is-active" : ""}`}
          onClick={handleThumbsDownClick}
          disabled={loading || pending}
          aria-pressed={myVote === -1}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Thumbs down"
          title={myVote === -1 && downReasonLabel ? `Thumbs down — ${downReasonLabel}` : "Thumbs down"}
        >
          <span className="calc-vote-icon" aria-hidden="true">👎</span>
          <span className="calc-vote-count">No</span>
        </button>

        {menuOpen && (
          <div className="calc-vote-menu" role="menu" aria-label="Why wasn't this helpful?">
            <span className="calc-vote-menu-title">What went wrong?</span>
            {DOWN_VOTE_REASONS.map((reason) => (
              <button
                key={reason.value}
                type="button"
                role="menuitem"
                className="calc-vote-menu-item"
                onClick={() => handleReasonSelect(reason.value)}
                disabled={pending}
              >
                {reason.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <span className="calc-vote-error" role="alert" title="Could not save your vote. Please try again.">
          !
        </span>
      )}
    </div>
  );
}
