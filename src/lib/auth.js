import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// Tracks the Supabase auth state for the app shell. Returns:
// - loading: true during the initial getSession() check (gate the UI behind this)
// - session: current Supabase session, or null when signed out
// - isPasswordRecovery: true while a password-reset link's recovery session
//   is active. The reset email lands the user back here with a recovery
//   token; we surface this flag so the app can route them to the
//   "set new password" screen until they complete the update.
export function useSessionState() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess ?? null);
      if (event === "PASSWORD_RECOVERY") setIsPasswordRecovery(true);
      else if (event === "USER_UPDATED" || event === "SIGNED_OUT") setIsPasswordRecovery(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading, isPasswordRecovery };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) console.warn("[auth] signOut error:", error);
}
