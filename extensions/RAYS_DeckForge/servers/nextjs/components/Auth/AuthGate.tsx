"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ConfigurationInitializer } from "@/app/ConfigurationInitializer";
import Home from "@/components/Home";
import { getApiUrl } from "@/utils/api";
import { formatFastApiDetail, UNAUTHORIZED_DETAIL } from "@/utils/authErrors";
import { toast } from "sonner";

type AuthStatus = {
  configured: boolean;
  authenticated: boolean;
  username: string | null;
};

const initialStatus: AuthStatus = {
  configured: false,
  authenticated: false,
  username: null,
};

export default function AuthGate() {
  const [status, setStatus] = useState<AuthStatus>(initialStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const isSetupMode = useMemo(() => !status.configured, [status.configured]);

  useEffect(() => {
    void refreshStatus();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "unauthorized") {
      toast.error("Unauthorized", {
        id: "auth-unauthorized-redirect",
        description: "Sign in to view this page.",
        duration: 5000,
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const refreshStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("/api/v1/auth/status"), {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Could not load login state");
      }

      const data = (await response.json()) as AuthStatus;
      setStatus({
        configured: Boolean(data.configured),
        authenticated: Boolean(data.authenticated),
        username: data.username ?? null,
      });
    } catch (fetchError) {
      console.error(fetchError);
      setError("Could not connect to the login service. Please refresh and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const cleanedUsername = username.trim();
    if (cleanedUsername.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (isSetupMode && password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        getApiUrl(isSetupMode ? "/api/v1/auth/setup" : "/api/v1/auth/login"),
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: cleanedUsername,
            password,
          }),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        const detail = formatFastApiDetail(payload?.detail);
        if (response.status === 401) {
          setError(detail === UNAUTHORIZED_DETAIL ? UNAUTHORIZED_DETAIL : detail);
        } else {
          setError(detail || "Login failed. Please try again.");
        }
        return;
      }

      if (isSetupMode) {
        setStatus({
          configured: true,
          authenticated: false,
          username: (payload as AuthStatus).username ?? cleanedUsername,
        });
        setPassword("");
        setConfirmPassword("");
        toast.success("Account created", {
          description: "Sign in with your new username and password to continue.",
          duration: 6000,
        });
        return;
      }

      setStatus({
        configured: Boolean((payload as AuthStatus).configured),
        authenticated: Boolean((payload as AuthStatus).authenticated),
        username: (payload as AuthStatus).username ?? cleanedUsername,
      });
      setPassword("");
      setConfirmPassword("");
    } catch (submitError) {
      console.error(submitError);
      setError("Login service is unavailable. Please try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="relative min-h-screen overflow-hidden flex items-center justify-center p-6" style={{ background: '#000000' }}>
        <div className="relative z-10 w-full max-w-md">
          <div className="rays-panel-elevated p-8 text-center">
            <div className="text-2xl font-bold tracking-wider mb-5" style={{ color: '#ffffff', fontFamily: "'Space Mono', monospace" }}>RAYS</div>
            <div className="mx-auto mb-4 h-0.5 w-16 rounded-full" style={{ background: '#383838' }} />
            <h1 className="text-lg font-semibold" style={{ color: '#ffffff', fontFamily: "'Space Mono', monospace" }}>DeckForge</h1>
            <p className="mt-3 text-sm" style={{ color: '#888888', fontFamily: "'Space Mono', monospace" }}>Initializing system…</p>
            <div className="mt-6 flex justify-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: '#ffffff' }} />
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: '#888888', animationDelay: '0.2s' }} />
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: '#ffffff', animationDelay: '0.4s' }} />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (status.authenticated) {
    return (
      <ConfigurationInitializer>
        <Home />
      </ConfigurationInitializer>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6" style={{ background: '#000000' }}>

      <section className="relative z-10 w-full max-w-xl p-7 sm:p-10 rounded-[10px]" style={{ background: '#1d1d1d', border: '1px solid #383838' }}>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-[10px]" style={{ background: '#000000', border: '1px solid #383838' }}>
              <span className="font-bold text-xl" style={{ color: '#ffffff', fontFamily: "'Space Mono', monospace" }}>R</span>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#888888', fontFamily: "'Space Mono', monospace" }}>
                Secure instance
              </p>
              <h1 className="mt-1 text-2xl font-semibold leading-tight sm:text-[26px]" style={{ color: '#ffffff', fontFamily: "'Space Mono', monospace" }}>
                {isSetupMode ? "Create your admin login" : "Sign in to continue"}
              </h1>
            </div>
          </div>
        </div>

        <p className="text-base sm:text-lg" style={{ color: '#888888', fontFamily: "'Space Mono', monospace" }}>
          {isSetupMode
            ? "One-time setup for this deployment. You will use the same username and password on future visits."
            : "This deployment is protected. Enter your credentials to open the app."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <label htmlFor="username" className="block text-sm font-medium" style={{ color: '#ffffff', fontFamily: "'Space Mono', monospace" }}>
              Username
            </label>
            <input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="your-admin-user"
              className="w-full rays-input text-sm"
              style={{ fontFamily: "'Space Mono', monospace" }}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium" style={{ color: '#ffffff', fontFamily: "'Space Mono', monospace" }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isSetupMode ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              className="w-full rays-input text-sm"
              style={{ fontFamily: "'Space Mono', monospace" }}
              disabled={isSubmitting}
            />
          </div>

          {isSetupMode ? (
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium" style={{ color: '#ffffff', fontFamily: "'Space Mono', monospace" }}>
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your password"
                className="w-full rays-input text-sm"
                style={{ fontFamily: "'Space Mono', monospace" }}
                disabled={isSubmitting}
              />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-[10px] px-4 py-3 text-sm" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid #383838', color: '#ffffff', fontFamily: "'Space Mono', monospace" }}>
              {error}
            </div>
          ) : null}

          {!isSetupMode && status.configured ? (
            <p className="text-sm" style={{ color: '#888888', fontFamily: "'Space Mono', monospace" }}>
              Setup is complete for this instance. Use the username and password you configured.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full text-xs font-semibold py-3 rounded-[10px] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: '#ffffff', color: '#000000', fontFamily: "'Space Mono', monospace" }}
          >
            {isSubmitting
              ? isSetupMode
                ? "Saving credentials…"
                : "Signing in…"
              : isSetupMode
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
