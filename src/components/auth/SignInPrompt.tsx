"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export function currentPageLoginHref(anchor?: string, register = false) {
  const callback = typeof window === "undefined" ? "/student" : `${window.location.pathname}${window.location.search}${anchor ?? window.location.hash}`;
  return `/${register ? "register" : "login"}?callbackUrl=${encodeURIComponent(callback)}`;
}

export function redirectIfUnauthorized(response: Response) {
  if (response.status !== 401) return false;
  window.location.assign(currentPageLoginHref());
  return true;
}

export function SignInPrompt({ message = "Sign in to continue.", anchor }: { message?: string; anchor?: string }) {
  const [links, setLinks] = useState({ login: "/login", register: "/register" });
  useEffect(() => { setLinks({ login: currentPageLoginHref(anchor), register: currentPageLoginHref(anchor, true) }); }, [anchor]);
  return <div className="space-y-3 text-sm">
    <p className="text-muted-foreground">{message}</p>
    <div className="flex flex-wrap items-center gap-3">
      <Link href={links.login} className="inline-flex rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Sign in</Link>
      <Link href={links.register} className="font-semibold text-primary underline underline-offset-4">Create an account</Link>
    </div>
  </div>;
}

/** Mount inside an open dialog so every new action checks the current session. */
export function ActionAuthGate({ children, message }: { children: ReactNode; message: string }) {
  const [status, setStatus] = useState<"loading" | "signedIn" | "guest" | "error">("loading");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setStatus("loading");
    fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Unable to check sign-in.");
        const session = await response.json();
        if (!disposed) setStatus(session?.user?.id ? "signedIn" : "guest");
      })
      .catch(() => { if (!disposed) setStatus("error"); })
      .finally(() => clearTimeout(timeout));
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); };
  }, [retry]);
  if (status === "signedIn") return <>{children}</>;
  return <div className="p-5 sm:p-6">
    {status === "loading" ? <p role="status" className="text-sm text-muted-foreground">Checking sign-in…</p> : status === "error" ? <div role="alert" className="space-y-2 text-sm"><p>Unable to check sign-in. Please try again.</p><button type="button" onClick={() => setRetry(value => value + 1)} className="text-primary underline">Retry</button></div> : <SignInPrompt message={message} />}
  </div>;
}
