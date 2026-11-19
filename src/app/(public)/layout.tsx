import { getCustomNavbarFilters } from "@/lib/custom-navbar-filters";
import { CollegeComparison } from "@/components/public/CollegeComparison";
import { Navbar } from "@/components/public/Navbar";
import { Footer } from "@/components/public/Footer";
import { MobileBottomNav } from "@/components/public/MobileBottomNav";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const customFilters = await getCustomNavbarFilters(true);
  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20 selection:text-primary pb-14 md:pb-0">
      <CollegeComparison>
      <Navbar customFilters={customFilters} />
      <main className="flex-1 min-w-0">{children}</main>
      <Footer />
      <MobileBottomNav />
      </CollegeComparison>
    </div>
  );
}

