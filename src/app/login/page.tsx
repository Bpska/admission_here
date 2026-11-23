import type { Metadata } from "next";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { portalDestination } from "@/lib/portal-navigation";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in | Admission Here",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    email?: string;
    registered?: string;
  }>;
}) {
  const query = await searchParams;
  const session = await auth();
  const user = session?.user as {
    role?: string;
    managedCollegeId?: string | null;
  };
  if (user?.role)
    redirect(
      portalDestination(user.role, user.managedCollegeId, query.callbackUrl),
    );
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <LoginForm
        callbackUrl={query.callbackUrl}
        initialEmail={query.email?.slice(0, 254)}
        registered={query.registered === "1"}
      />
    </main>
  );
}
