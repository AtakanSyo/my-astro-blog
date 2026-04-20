import { useEffect, useState } from "react";
import { hasSupabasePublicEnv, supabase } from "../lib/supabase/client";

function normalizePath(path) {
  if (!path) return "/";
  const withoutQuery = path.split("?")[0]?.split("#")[0] ?? path;
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, "") : withoutQuery;
}

export default function HeaderAccountStatus({ currentPath = "" }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!hasSupabasePublicEnv || !supabase) return;

    let mounted = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSignedIn(Boolean(data.session?.user));
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSignedIn(Boolean(currentSession?.user));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isCurrent = normalizePath(currentPath) === "/account";
  const label = signedIn ? "Signed in" : "Sign in";

  return (
    <a
      href="/account"
      className="nav-item nav-account-status"
      aria-current={isCurrent ? "page" : undefined}
      data-auth={signedIn ? "in" : "out"}
      title={signedIn ? "Open your account" : "Sign in to your account"}
    >
      {label}
    </a>
  );
}
