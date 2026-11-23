"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { registrationSchema } from "@/lib/auth/account-validation";
import { portalDestination } from "@/lib/portal-navigation";

export function RegisterForm({ callbackUrl }: { callbackUrl?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loginPath = `/login${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const input = registrationSchema.safeParse({ name, email, password });
    if (!input.success) {
      setError(input.error.issues[0]?.message || "Check your account details.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.data),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Unable to create your account.");
      try {
        const login = await signIn("credentials", {
          email: input.data.email,
          password,
          redirect: false,
        });
        if (login?.error) throw Error("Sign in to continue.");
        const session = await (
          await fetch("/api/auth/session", { cache: "no-store" })
        ).json();
        if (session?.user?.role !== "STUDENT")
          throw Error("Sign in to continue.");
        window.location.assign(portalDestination("STUDENT", null, callbackUrl));
      } catch {
        const params = new URLSearchParams({
          registered: "1",
          email: input.data.email,
        });
        if (callbackUrl) params.set("callbackUrl", callbackUrl);
        window.location.assign(`/login?${params}`);
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Account creation is temporarily unavailable. Try again shortly.",
      );
      setBusy(false);
    }
  }
  const field =
    "mt-1 block w-full rounded-lg border bg-background px-3 py-2.5 text-sm";
  return (
    <section className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-5 shadow-xl sm:p-8">
      <div className="space-y-2 text-center">
        <Link href="/" className="inline-flex">
          <Image
            src="/logo.png"
            alt="Admission Here"
            width={220}
            height={55}
            className="h-12 w-auto object-contain"
          />
        </Link>
        <h1 className="text-xl font-bold">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Keep your admissions profile, applications and college reviews in one
          place.
        </p>
      </div>
    <noscript><p className="text-sm text-muted-foreground">Enable JavaScript to create an account.</p></noscript>
    {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
    <form method="post" onSubmit={submit} className="space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          <label className="block text-sm font-semibold">
            Full name
            <input
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={field}
            />
          </label>
          <label className="block text-sm font-semibold">
            Email address
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className={field}
            />
          </label>
          <div>
            <label
              className="block text-sm font-semibold"
              htmlFor="register-password"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="register-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`${field} pr-10`}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-2 rounded p-1 text-muted-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Use at least 8 characters. A longer, unique passphrase is better.
            </p>
          </div>
          <label className="block text-sm font-semibold">
            Confirm password
            <input
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={field}
            />
          </label>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {busy ? "Creating account…" : "Create account"}
          </button>
        </fieldset>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href={loginPath} className="font-semibold text-primary underline">
          Sign in
        </Link>
      </p>
      <Link
        href="/"
        className="block text-center text-xs text-muted-foreground underline"
      >
        Back to the website
      </Link>
    </section>
  );
}
