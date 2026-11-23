import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { portalDestination } from "@/lib/portal-navigation";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Create an account | Admission Here",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const session = await auth();
  const user = session?.user as {
    role?: string;
    managedCollegeId?: string | null;
  };
  if (user?.role)
    redirect(portalDestination(user.role, user.managedCollegeId, callbackUrl));
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <RegisterForm callbackUrl={callbackUrl} />
    </main>
  );
}
