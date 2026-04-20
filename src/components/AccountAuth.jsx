import { useEffect, useState } from "react";
import { hasSupabasePublicEnv, supabase } from "../lib/supabase/client";

export default function AccountAuth() {
  const [email, setEmail] = useState("");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
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
    setMessage("");
    setError("");

    const emailValue = email.trim();
    if (!emailValue) {
      setError("Please enter an email.");
      return;
    }

    const redirectTo = `${window.location.origin}/account`;
    if (!supabase) {
      setError("Supabase is not configured.");
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
      return;
    }

    setMessage("Magic link sent. Check your email.");
  }

  async function handleLogout() {
    setMessage("");
    setError("");
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    setMessage("You are signed out.");
  }

  if (loading) {
    return <p>Checking account status...</p>;
  }

  return (
    <section className="about-card account-auth-card">
      <h2>Reader Account</h2>

      {session?.user ? (
        <>
          <p>
            Signed in as <strong>{session.user.email}</strong>
          </p>
          <button className="account-btn" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <p>Sign in with email. No password required.</p>
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
            <button className="account-btn" type="submit">
              Send Magic Link
            </button>
          </form>
        </>
      )}

      {message && <p className="account-message">{message}</p>}
      {error && <p className="account-error">{error}</p>}
    </section>
  );
}
