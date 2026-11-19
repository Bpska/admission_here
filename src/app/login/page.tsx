"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { Lock, Mail, ArrowRight } from "lucide-react";
import Link from "next/link";
import { portalDestination } from "@/lib/portal-navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const [email, setEmail] = useState("");
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
    setLoading(true);
    setError(null);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid email address or password.");
      } else {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const session = await response.json();
        if (!session?.user) throw new Error("Sign-in could not be completed.");
        if (savePassword) {
          // Let the browser manage credentials; never write passwords to app storage.
          const PasswordCredential = (window as unknown as {
            PasswordCredential?: new (data: { id: string; password: string; name?: string }) => Credential;
          }).PasswordCredential;
          if (window.isSecureContext && PasswordCredential && navigator.credentials?.store) {
            try {
              await navigator.credentials.store(new PasswordCredential({
                id: email,
                password,
                name: session.user.name || email,
              }));
            } catch {
              // Browser settings may decline saving; successful login continues.
            }
          }
        }
        router.replace(portalDestination(session.user.role, session.user.managedCollegeId, callbackUrl));
        router.refresh();
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
        <h1 className="text-xl font-bold text-foreground">Sign In to Your Account</h1>
        <p className="text-xs text-muted-foreground">
          Access RBAC Admin CMS, Counselor Lead CRM, or Student Applications.
        </p>
      </div>

      {error && (
        <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} autoComplete={savePassword ? "on" : "off"} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-xs font-semibold text-muted-foreground mb-1">
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@admissionhere.in"
              className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg bg-background outline-hidden focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label htmlFor="login-password" className="block text-xs font-semibold text-muted-foreground mb-1">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              id="login-password"
              name="password"
              autoComplete={savePassword ? "current-password" : "off"}
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg bg-background outline-hidden focus:border-primary"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={savePassword}
              onChange={(event) => setSavePassword(event.target.checked)}
              className="rounded border-input accent-primary"
            />
            Save password in this browser
          </label>
          <p className="text-xs text-muted-foreground">
            Your browser’s password manager controls saving and autofill. Availability depends on your browser settings.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <Suspense fallback={<div className="text-xs text-muted-foreground">Loading login...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
