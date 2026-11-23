"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { Lock, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { portalDestination } from "@/lib/portal-navigation";

export function LoginForm({
  callbackUrl,
  initialEmail = "",
  registered = false,
}: {
  callbackUrl?: string;
  initialEmail?: string;
  registered?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [savePassword, setSavePassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Remove credentials saved by the retired remember-login feature.
    try {
      localStorage.removeItem("admissionhere_saved_accounts");
    } catch {
      // Login still works when browser storage is unavailable.
    }
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(
          res.code === "rate_limited"
            ? "Too many sign-in attempts. Please wait 15 minutes and try again."
            : res.error === "CredentialsSignin"
              ? "Invalid email address or password."
              : "Sign-in is temporarily unavailable. Please try again shortly.",
        );
      } else {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        const session = await response.json();
        if (!session?.user) throw new Error("Sign-in could not be completed.");
        if (savePassword) {
          // Let the browser manage credentials; never write passwords to app storage.
          const PasswordCredential = (
            window as unknown as {
              PasswordCredential?: new (data: {
                id: string;
                password: string;
                name?: string;
              }) => Credential;
            }
          ).PasswordCredential;
          if (
            window.isSecureContext &&
            PasswordCredential &&
            navigator.credentials?.store
          ) {
            try {
              await navigator.credentials.store(
                new PasswordCredential({
                  id: email,
                  password,
                  name: session.user.name || email,
                }),
              );
            } catch {
              // Browser settings may decline saving; successful login continues.
            }
          }
        }
        window.location.assign(
          portalDestination(
            session.user.role,
            session.user.managedCollegeId,
            callbackUrl,
          ),
        );
      }
    } catch (err) {
      setError("An unexpected error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-card border rounded-2xl p-4 sm:p-8 shadow-xl space-y-5 sm:space-y-6">
      <div className="text-center space-y-2">
        <Link href="/" className="inline-flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Admission Here"
            width={220}
            height={55}
            className="h-12 w-auto object-contain"
          />
        </Link>
        <h1 className="text-xl font-bold text-foreground">
          Sign In to Your Account
        </h1>
        <p className="text-xs text-muted-foreground">
          Manage your profile, applications and college activity.
        </p>
      </div>

      {registered && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          Your account is ready. Sign in to continue.
        </p>
      )}
      <noscript><p className="text-sm text-muted-foreground">Enable JavaScript to sign in.</p></noscript>
      {error && (
        <div
          role="alert"
          className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg"
        >
          {error}
        </div>
      )}

      <form
        method="post"
        onSubmit={handleLogin}
        autoComplete={savePassword ? "on" : "off"}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold text-muted-foreground mb-1"
          >
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              id="login-email"
              name="email"
              autoComplete={savePassword ? "username" : "off"}
              type="email"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg bg-background outline-hidden focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="block text-xs font-semibold text-muted-foreground mb-1"
          >
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              id="login-password"
              name="password"
              autoComplete={savePassword ? "current-password" : "off"}
              type={showPassword ? "text" : "password"}
              required
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-9 pr-10 py-2 text-xs border rounded-lg bg-background outline-hidden focus:border-primary"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1.5 rounded p-1 text-muted-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              disabled={loading}
              checked={savePassword}
              onChange={(event) => setSavePassword(event.target.checked)}
              className="rounded border-input accent-primary"
            />
            Save password in this browser
          </label>
          <p className="text-xs text-muted-foreground">
            Your browser’s password manager controls saving and autofill.
            Availability depends on your browser settings.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
        >
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span className="sr-only">Signing in…</span></>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href={`/register${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
          className="font-semibold text-primary underline"
        >
          Create an account
        </Link>
      </p>
      <Link
        href="/"
        className="block text-center text-xs text-muted-foreground underline"
      >
        Back to the website
      </Link>
    </div>
  );
}
