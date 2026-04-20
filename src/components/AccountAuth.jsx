import { useEffect, useState } from "react";
import { hasSupabasePublicEnv, supabase } from "../lib/supabase/client";

export default function AccountAuth() {
  const [email, setEmail] = useState("");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasSupabasePublicEnv || !supabase) {
      setError(
        "Supabase is not configured for this environment. Add PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY."
      );
      setLoading(false);
      return;
    }

    let mounted = true;

    async function loadSession() {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;

      if (sessionError) {
        setError(sessionError.message);
      } else {
        setSession(data.session ?? null);
      }
      setLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleMagicLink(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setMessage("");
    setError("");

    const emailValue = email.trim();
    if (!emailValue) {
      setError("Please enter an email.");
      setSubmitting(false);
      return;
    }

    const redirectTo = `${window.location.origin}/account`;
    if (!supabase) {
      setError("Supabase is not configured.");
      setSubmitting(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: emailValue,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    setMessage("Magic link sent. Check your inbox and spam folder.");
    setSubmitting(false);
  }

  async function handleLogout() {
    if (signingOut) return;

    setSigningOut(true);
    setMessage("");
    setError("");
    if (!supabase) {
      setError("Supabase is not configured.");
      setSigningOut(false);
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      setSigningOut(false);
      return;
    }
    setMessage("You are signed out.");
    setSigningOut(false);
  }

  if (loading) {
    return (
      <section className="about-card account-auth-card account-auth-card--loading">
        <h2>Reader Account</h2>
        <p>Checking account status...</p>
      </section>
    );
  }

  return (
    <section className="about-card account-auth-card">
      <h2>Reader Account</h2>
      <p className="account-muted">
        Passwordless sign in. Enter your email and we will send a secure magic link.
      </p>

      {session?.user ? (
        <div className="account-session">
          <p className="account-status-chip">Signed in</p>
          <p>
            Signed in as <strong>{session.user.email}</strong>
          </p>
          <button
            className="account-btn"
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      ) : (
        <>
          <form className="account-form" onSubmit={handleMagicLink}>
            <label htmlFor="account-email">Email</label>
            <input
              id="account-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <button className="account-btn" type="submit" disabled={submitting}>
              {submitting ? "Sending link..." : "Send Magic Link"}
            </button>
          </form>
          <p className="account-help">
            The link opens this page and signs you in automatically. It expires quickly for security.
          </p>
        </>
      )}

      {message && (
        <p className="account-message" aria-live="polite">
          {message}
        </p>
      )}
      {error && (
        <p className="account-error" aria-live="polite">
          {error}
        </p>
      )}
    </section>
  );
}
