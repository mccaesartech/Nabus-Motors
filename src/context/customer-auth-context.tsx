"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  clearSupabaseAuthFromAllStorages,
} from "@/lib/supabase/auth-storage";
import {
  customerDisplayName,
  type CustomerProfile,
} from "@/lib/customer/auth";
import {
  clearSessionPreferencePromptPending,
  clearSessionTiming,
  getSessionPreference,
  markSessionPreferencePromptPending,
  recordSessionStart,
  setSessionPreference,
  shouldShowSessionPreferencePrompt,
  type SessionPreference,
} from "@/lib/customer/session-preference";
import { SessionPreferenceModal } from "@/components/customer/session-preference-modal";
import { CustomerSessionGuard } from "@/components/customer/customer-session-guard";
import { readPendingVehicleInterest, clearPendingVehicleInterest } from "@/lib/vehicle-interest/client";
import { resolveCustomerApiUrl } from "@/lib/site-url";

type CustomerAuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: CustomerProfile | null;
  displayName: string;
  loading: boolean;
  configured: boolean;
  sessionPreference: SessionPreference | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  applySessionPreference: (preference: SessionPreference) => Promise<void>;
  promptSessionPreference: () => void;
  sessionPreferenceModalOpen: boolean;
};

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionPreference, setSessionPreferenceState] = useState<SessionPreference | null>(null);
  const [sessionPreferenceModalOpen, setSessionPreferenceModalOpen] = useState(false);
  const configured = isSupabaseConfigured;

  const loadProfile = useCallback(async (nextUser: User | null) => {
    if (!supabase || !nextUser) {
      setProfile(null);
      return;
    }

    const enrichedSelect =
      "id, first_name, last_name, phone, registration_id, session_preference, avatar_url, address_line, city, country, preferred_contact, created_at, email";
    const coreSelect =
      "id, first_name, last_name, phone, registration_id, session_preference";

    let row: (CustomerProfile & { session_preference?: string | null }) | null = null;

    const enriched = await supabase
      .from("profiles")
      .select(enrichedSelect)
      .eq("id", nextUser.id)
      .maybeSingle();

    if (!enriched.error) {
      row = enriched.data as (CustomerProfile & { session_preference?: string | null }) | null;
    } else {
      const fallback = await supabase
        .from("profiles")
        .select(coreSelect)
        .eq("id", nextUser.id)
        .maybeSingle();
      if (fallback.error) {
        setProfile(null);
        return;
      }
      row = fallback.data as (CustomerProfile & { session_preference?: string | null }) | null;
    }

    setProfile(row ?? null);

    const profilePref = row?.session_preference;
    if (
      profilePref === "stay_signed_in" ||
      profilePref === "ask_each_time" ||
      profilePref === "no_save"
    ) {
      const localPref = getSessionPreference();
      if (!localPref) {
        setSessionPreference(profilePref);
      }
      setSessionPreferenceState(getSessionPreference() ?? profilePref);
    } else {
      setSessionPreferenceState(getSessionPreference());
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(user);
  }, [loadProfile, user]);

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const syncAccount = useCallback(
    async (
      nextUser: User,
      preference?: SessionPreference,
      options?: { recordLogin?: boolean; loginMethod?: string }
    ) => {
      const token = await getAccessToken();
      if (!token || !nextUser.email) return;
      try {
        const vehicleInterestPending = readPendingVehicleInterest();
        const res = await fetch(resolveCustomerApiUrl("/api/customer/sync-account"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...(preference ? { sessionPreference: preference } : {}),
            ...(vehicleInterestPending.length
              ? { vehicleInterestPending }
              : {}),
            ...(options?.recordLogin ? { recordLogin: true } : {}),
            ...(options?.loginMethod
              ? { loginMethod: options.loginMethod }
              : {}),
          }),
        });
        if (!res.ok) {
          console.warn(
            "[customer-auth] sync-account failed:",
            res.status,
            await res.text().catch(() => "")
          );
        }
        if (vehicleInterestPending.length) {
          clearPendingVehicleInterest();
        }
        await loadProfile(nextUser);
      } catch (error) {
        console.warn(
          "[customer-auth] sync-account error:",
          error instanceof Error ? error.message : error
        );
      }
    },
    [getAccessToken, loadProfile]
  );

  const applySessionPreference = useCallback(
    async (preference: SessionPreference) => {
      if (!supabase) return;

      const { data } = await supabase.auth.getSession();
      const activeSession = data.session;

      clearSupabaseAuthFromAllStorages();
      setSessionPreference(preference);
      setSessionPreferenceState(preference);
      recordSessionStart();
      clearSessionPreferencePromptPending();

      if (activeSession) {
        await supabase.auth.setSession({
          access_token: activeSession.access_token,
          refresh_token: activeSession.refresh_token,
        });
        await syncAccount(activeSession.user, preference);
      }
    },
    [syncAccount]
  );

  const promptSessionPreference = useCallback(() => {
    markSessionPreferencePromptPending();
    setSessionPreferenceModalOpen(true);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setSessionPreferenceState(getSessionPreference());
      void loadProfile(data.session?.user ?? null).finally(() => {
        if (mounted) setLoading(false);
      });
      if (data.session?.user) {
        const syncLater = () => void syncAccount(data.session!.user);
        if (typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(syncLater, { timeout: 4000 });
        } else {
          setTimeout(syncLater, 200);
        }
        if (shouldShowSessionPreferencePrompt()) {
          setSessionPreferenceModalOpen(true);
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      void loadProfile(nextSession?.user ?? null);

      if (event === "SIGNED_IN" && nextSession?.user) {
        recordSessionStart();
        let recordLogin = false;
        let loginMethod = "password";
        try {
          const pending = sessionStorage.getItem("tg_pending_login_method");
          if (pending) {
            sessionStorage.removeItem("tg_pending_login_method");
            recordLogin = true;
            loginMethod = pending.slice(0, 32);
          }
        } catch {
          // private mode / SSR — skip history only
        }
        const syncLater = () =>
          void syncAccount(
            nextSession.user,
            undefined,
            recordLogin ? { recordLogin: true, loginMethod } : undefined
          );
        if (typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(syncLater, { timeout: 4000 });
        } else {
          setTimeout(syncLater, 200);
        }
        if (shouldShowSessionPreferencePrompt()) {
          setSessionPreferenceModalOpen(true);
        }
      }

      if (event === "SIGNED_OUT") {
        clearSessionTiming();
        setSessionPreferenceModalOpen(false);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile, syncAccount]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    clearSupabaseAuthFromAllStorages();
    clearSessionTiming();
    setProfile(null);
  }, []);

  const displayName = useMemo(() => {
    if (!user) return "";
    return customerDisplayName(profile, user);
  }, [profile, user]);

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      displayName,
      loading,
      configured,
      sessionPreference,
      signOut,
      refreshProfile,
      getAccessToken,
      applySessionPreference,
      promptSessionPreference,
      sessionPreferenceModalOpen,
    }),
    [
      user,
      session,
      profile,
      displayName,
      loading,
      configured,
      sessionPreference,
      signOut,
      refreshProfile,
      getAccessToken,
      applySessionPreference,
      promptSessionPreference,
      sessionPreferenceModalOpen,
    ]
  );

  return (
    <CustomerAuthContext.Provider value={value}>
      <CustomerSessionGuard />
      {children}
      <SessionPreferenceModal
        open={sessionPreferenceModalOpen}
        onOpenChange={setSessionPreferenceModalOpen}
        initialPreference={sessionPreference}
        onConfirm={applySessionPreference}
      />
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) {
    throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  }
  return ctx;
}
