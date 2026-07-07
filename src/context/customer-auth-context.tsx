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

    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, phone, registration_id, session_preference")
      .eq("id", nextUser.id)
      .maybeSingle();

    const row = data as (CustomerProfile & { session_preference?: string | null }) | null;
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
    async (nextUser: User, preference?: SessionPreference) => {
      const token = await getAccessToken();
      if (!token || !nextUser.email) return;
      try {
        const vehicleInterestPending = readPendingVehicleInterest();
        await fetch("/api/customer/sync-account", {
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
          }),
        });
        if (vehicleInterestPending.length) {
          clearPendingVehicleInterest();
        }
        await loadProfile(nextUser);
      } catch {
        // Non-blocking — account page will retry via inquiries fetch
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
        const syncLater = () => void syncAccount(nextSession.user);
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
