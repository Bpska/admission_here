"use client";

import Link from "next/link";
import Image from "next/image";
import { CATEGORIES, type SubItem } from "@/lib/navbar-items";
import { navbarFilterHref, type NavbarFilterOption } from "@/lib/navbar-filters";
import { useState, useEffect, useRef } from "react";
import { 
  Search, 
  Sparkles, 
  Compass, 
  BookOpen, 
  Layers, 
  Menu, 
  X,
  UserCheck,
  Newspaper,
  ChevronRight,
  ChevronDown,
  Building2,
  GraduationCap,
  MapPin,
  ArrowRight
} from "lucide-react";
import { AiCounselorDrawer } from "../ai/AiCounselorDrawer";
import { AiSearchCommandBar } from "../ai/AiSearchCommandBar";

export function Navbar({ customFilters = [] }: { customFilters?: NavbarFilterOption[] }) {
  const categories = CATEGORIES.map(category => ({ ...category, columns: category.columns.map((column, index) => ({ ...column, items: [...column.items, ...customFilters.filter(item => item.category === category.key && item.section === `column_${index + 1}`).map((item): SubItem => ({ label: item.label, href: item.href }))] })) }));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [counselorOpen, setCounselorOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Active hover category for the stream bar
  const [activeCategoryKey, setActiveCategoryKey] = useState<string | null>(null);
  const [mobileOpenCategory, setMobileOpenCategory] = useState<string | null>(null);

  const activeCategory = categories.find((c) => c.key === activeCategoryKey);

  const navBarRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navBarRef.current && !navBarRef.current.contains(e.target as Node)) {
        setActiveCategoryKey(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveCategoryKey(null);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <>
      <header ref={navBarRef} className="sticky top-0 z-50 w-full shadow-md">
        {/* Top Header Row: Logo, Search, Action Buttons */}
        <div className="w-full bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0 py-1">
              <Image
                src="/logo.png"
                alt="Admission Here Logo"
                width={220}
                height={55}
                className="h-11 sm:h-12 w-auto object-contain transition-transform hover:scale-[1.02]"
                priority
              />
            </Link>

            {/* Global Search Bar (Center) */}
            <div className="hidden md:flex flex-1 max-w-xl mx-4">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search colleges and blogs"
                className="w-full flex items-center justify-between px-4 py-2 text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-full transition-all cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <Search className="w-4 h-4 text-slate-400" />
                  <span>Search colleges, courses and blog articles...</span>
                </div>
                <kbd className="px-2 py-0.5 text-[10px] bg-white border rounded text-slate-500 font-mono shadow-2xs">
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Mobile Search Icon */}
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Free Counseling Button */}
              <button
                onClick={() => setCounselorOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg text-white shadow-xs transition-all cursor-pointer active:scale-95 bg-[#C41E1E] hover:bg-[#a81919]"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span className="hidden sm:inline">Free Counseling</span>
                <span className="sm:hidden">Help</span>
              </button>

              <Link href="/student" className="text-xs font-bold text-[#1a3068] px-2 py-2">My account</Link>
              {/* Admin Portal Button */}
              <Link
                href="/login?callbackUrl=%2Fadmin"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-[#1a3068] text-[#1a3068] rounded-lg hover:bg-[#1a3068] hover:text-white transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Admin</span>
              </Link>

              {/* Mobile Menu Hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-slate-800 hover:bg-slate-100 transition-colors"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6 text-red-600" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Second Row: Collegedunia/Shiksha Style Dark Teal/Navy Stream Navigation Bar */}
        <div
          className="relative hidden md:block w-full border-t border-teal-800"
          style={{ background: "#0b5858" }} // Deep Teal matching user screenshot
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center gap-0.5 lg:gap-1">
              {categories.map((cat) => {
                const isActive = activeCategoryKey === cat.key;
                return (
                  <div 
                    key={cat.key} 
                    className="relative"
                    onMouseEnter={() => setActiveCategoryKey(cat.key)}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveCategoryKey(isActive ? null : cat.key)}
                      className={`px-3 py-2 text-[12px] font-black uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                        isActive
                          ? "bg-black/25 text-white"
                          : "text-white/95 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span>{cat.label}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isActive ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Mega Dropdown Menu Panel (Full Width Floating Container) */}
          {activeCategory && (
            <div
              className="absolute top-full left-0 right-0 bg-white border-b border-slate-200 shadow-2xl py-6 animate-in fade-in slide-in-from-top-1 duration-150 z-50 text-slate-800"
              onMouseLeave={() => setActiveCategoryKey(null)}
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1F8040]" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                      {activeCategory.label} Admissions &amp; College Directory 2027
                    </h3>
                  </div>
                  <Link
                    href={activeCategory.mainHref}
                    onClick={() => setActiveCategoryKey(null)}
                    className="text-xs font-bold text-[#0b5858] hover:underline flex items-center gap-1"
                  >
                    <span>View All {activeCategory.label} Colleges</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* 3-Column Structured Grid */}
                <div className="grid grid-cols-3 gap-8">
                  {activeCategory.columns.map((col, idx) => (
                    <div key={idx} data-navbar-section={`column_${idx + 1}`} className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-100">
                        {col.title}
                      </h4>
                      <ul className="space-y-2">
                        {col.items.map((item, itemIdx) => (
                          <li key={itemIdx}>
                            <Link
                              href={navbarFilterHref(activeCategory.key, idx, item)}
                              onClick={() => setActiveCategoryKey(null)}
                              className="text-xs text-slate-700 hover:text-[#0b5858] hover:font-bold transition-colors flex items-center justify-between group"
                            >
                              <span className="group-hover:translate-x-0.5 transition-transform">
                                {item.label}
                              </span>
                              {item.badge && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded-sm">
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Accordion Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-3 shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Academic Streams &amp; Programs
            </div>

            <div className="space-y-1">
              {categories.map((cat) => {
                const isOpen = mobileOpenCategory === cat.key;
                return (
                  <div key={cat.key} className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setMobileOpenCategory(isOpen ? null : cat.key)}
                      className="w-full flex items-center justify-between p-3 text-left font-bold text-xs text-slate-800"
                    >
                      <span className="uppercase">{cat.label}</span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="p-3 pt-0 border-t border-slate-200 bg-white space-y-3">
                        {cat.columns.map((col, idx) => (
                          <div key={idx} data-navbar-section={`column_${idx + 1}`} className="space-y-1 pt-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">
                              {col.title}
                            </div>
                            {col.items.map((sub, sIdx) => (
                              <Link
                                key={sIdx}
                                href={navbarFilterHref(cat.key, idx, sub)}
                                onClick={() => setMobileMenuOpen(false)}
                                className="block py-1 text-xs text-slate-700 hover:text-[#0b5858] font-medium"
                              >
                                • {sub.label}
                              </Link>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Links */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <Link
                href="/login?callbackUrl=%2Fadmin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800"
              >
                <UserCheck className="w-4 h-4 text-[#1a3068]" />
                <span>Admin Login Portal</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* AI Counselor Drawer Modal */}
      <AiCounselorDrawer open={counselorOpen} onClose={() => setCounselorOpen(false)} />

      {/* Search Command Bar Modal */}
      <AiSearchCommandBar open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
