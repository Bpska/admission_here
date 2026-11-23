import { getCustomNavbarFilters } from "@/lib/custom-navbar-filters";
import { CollegeComparison } from "@/components/public/CollegeComparison";
import { Navbar } from "@/components/public/Navbar";
import { Footer } from "@/components/public/Footer";
import { MobileBottomNav } from "@/components/public/MobileBottomNav";
import { auth } from "@/lib/auth/config";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const customFilters = await getCustomNavbarFilters(true);
  const session = await auth();
  const user = session?.user as { name?: string | null; role?: string; designation?: string | null; managedCollegeId?: string | null } | undefined;
  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20 selection:text-primary pb-14 md:pb-0">
      <CollegeComparison>
      <Navbar customFilters={customFilters} account={user?.role ? { name: user.name || "User", role: user.role, designation: user.designation, managedCollegeId: user.managedCollegeId } : null} />
      <main className="flex-1 min-w-0">{children}</main>
      <Footer />
      <MobileBottomNav />
      </CollegeComparison>
    </div>
  );
}

