"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  Plus,
  Send,
  Sparkles,
  Trash2,
  CheckCircle2,
  FileText,
  Layers,
} from "lucide-react";
import { toDateTimeLocalValue } from "@/lib/blog-schedule";

export interface CalendarBlogPost {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: string;
  showOnWebsiteBlog: boolean;
  publishedAt: string | null;
  createdAt: string;
  authorName: string;
}

export interface CollegeOption {
  slug: string;
  name: string;
}

interface BatchBlogRow {
  key: string;
  title: string;
  category: string;
  showOnWebsiteBlog: boolean;
  relatedCollegeSlug: string;
  scheduledAt: string;
  tags: string;
  contentMdx: string;
}

interface BlogScheduleCalendarProps {
  initialPosts: CalendarBlogPost[];
  colleges: CollegeOption[];
  basePath: "/admin/blogs" | "/admin/staff-blogs";
  canPublish: boolean;
}

const CATEGORIES = [
  { value: "CUTOFF_ANALYSIS", label: "Cutoff Analysis" },
  { value: "EXAM_NEWS", label: "Exam News & Live Updates" },
  { value: "ADMISSION_ALERT", label: "Admission Alert" },
  { value: "COLLEGE_ROUNDUP", label: "College Roundup" },
  { value: "CAREER_GUIDE", label: "Career Guide" },
  { value: "SCHOLARSHIP", label: "Scholarships" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function defaultDateTimeForDay(dayStr: string, hour = 9, minute = 0): string {
  return `${dayStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function makeEmptyRow(dayStr: string, hourOffset = 0): BatchBlogRow {
  const baseDate = new Date(`${dayStr}T09:00`);
  baseDate.setHours(baseDate.getHours() + hourOffset);
  return {
    key: crypto.randomUUID(),
    title: "",
    category: "CUTOFF_ANALYSIS",
    showOnWebsiteBlog: true,
    relatedCollegeSlug: "",
    scheduledAt: toDateTimeLocalValue(baseDate),
    tags: "",
    contentMdx: "",
  };
}

export function BlogScheduleCalendar({
  initialPosts,
  colleges,
  basePath,
  canPublish,
}: BlogScheduleCalendarProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<CalendarBlogPost[]>(initialPosts);
  const [activeView, setActiveView] = useState<"calendar" | "batch" | "drafts">("calendar");

  // Calendar state
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string>(dateKey(today));

  // Inline reschedule state for selected day panel
  const [rescheduleValues, setRescheduleValues] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // Multi-blog batch composer state
  const tomorrowKey = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return dateKey(t);
  }, []);
  const [batchRows, setBatchRows] = useState<BatchBlogRow[]>(() => [
    makeEmptyRow(tomorrowKey, 0),
    makeEmptyRow(tomorrowKey, 24),
  ]);
  const [spreadStart, setSpreadStart] = useState<string>(() => defaultDateTimeForDay(tomorrowKey, 9, 0));
  const [spreadHours, setSpreadHours] = useState<number>(24);
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // Existing drafts quick-schedule state
  const [draftTimes, setDraftTimes] = useState<Record<string, string>>({});
  const [draftSubmitting, setDraftSubmitting] = useState(false);

  // Feedback banner
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Map posts to calendar date keys
  const postsByDay = useMemo(() => {
    const map = new Map<string, CalendarBlogPost[]>();
    for (const post of posts) {
      const refDate = post.publishedAt ? new Date(post.publishedAt) : null;
      if (!refDate || Number.isNaN(refDate.getTime())) continue;
      if (post.status !== "SCHEDULED" && post.status !== "PUBLISHED") continue;
      const key = dateKey(refDate);
      const list = map.get(key) || [];
      list.push(post);
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => new Date(a.publishedAt || 0).getTime() - new Date(b.publishedAt || 0).getTime());
    }
    return map;
  }, [posts]);

  const scheduledPosts = useMemo(
    () =>
      posts
        .filter((p) => p.status === "SCHEDULED" && p.publishedAt)
        .sort((a, b) => new Date(a.publishedAt!).getTime() - new Date(b.publishedAt!).getTime()),
    [posts]
  );

  const draftPosts = useMemo(
    () => posts.filter((p) => p.status === "DRAFT"),
    [posts]
  );

  // Calendar month cells
  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ date: Date; key: string; inMonth: boolean }> = [];

    // Leading days from previous month
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth, -i);
      cells.push({ date: d, key: dateKey(d), inMonth: false });
    }
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewYear, viewMonth, day);
      cells.push({ date: d, key: dateKey(d), inMonth: true });
    }
    // Trailing days to complete 6 rows or last week
    while (cells.length % 7 !== 0) {
      const d = new Date(viewYear, viewMonth + 1, cells.length - (startWeekday + daysInMonth) + 1);
      cells.push({ date: d, key: dateKey(d), inMonth: false });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const selectedDayPosts = postsByDay.get(selectedDay) || [];

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDay(dateKey(now));
  };

  const handleQuickPatch = async (
    postId: string,
    payload: { status?: string; publishedAt?: string | null },
    successMsg: string
  ) => {
    setBusyId(postId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/cms/blogs/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to update schedule");
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                status: json.post.status,
                publishedAt: json.post.publishedAt ? new Date(json.post.publishedAt).toISOString() : null,
              }
            : p
        )
      );
      setFeedback({ type: "success", text: successMsg });
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to update blog schedule" });
    } finally {
      setBusyId(null);
    }
  };

  const addBlogForSelectedDay = () => {
    const newRow = makeEmptyRow(selectedDay, 0);
    setBatchRows((prev) => {
      // If existing rows are all untouched empty defaults, replace the first empty one or append
      const hasContent = prev.some((r) => r.title.trim() || r.contentMdx.trim());
      return hasContent ? [...prev, newRow] : [newRow];
    });
    setActiveView("batch");
  };

  const handleAutoSpread = () => {
    if (!spreadStart) return;
    const base = new Date(spreadStart);
    if (Number.isNaN(base.getTime())) return;
    setBatchRows((rows) =>
      rows.map((row, idx) => {
        const d = new Date(base.getTime() + idx * spreadHours * 3600 * 1000);
        return { ...row, scheduledAt: toDateTimeLocalValue(d) };
      })
    );
    setFeedback({
      type: "success",
      text: `Assigned staggered schedule times across ${batchRows.length} blog${batchRows.length === 1 ? "" : "s"}.`,
    });
  };

  const handleBatchCreateSubmit = async () => {
    setFeedback(null);
    if (batchRows.length === 0) {
      setFeedback({ type: "error", text: "Add at least one blog post to schedule." });
      return;
    }
    for (let i = 0; i < batchRows.length; i++) {
      const row = batchRows[i];
      if (row.title.trim().length < 3) {
        setFeedback({ type: "error", text: `Blog #${i + 1}: Title must be at least 3 characters.` });
        return;
      }
      if (row.contentMdx.trim().length < 10) {
        setFeedback({ type: "error", text: `Blog #${i + 1}: Content must be at least 10 characters.` });
        return;
      }
      if (!row.scheduledAt || Number.isNaN(new Date(row.scheduledAt).getTime())) {
        setFeedback({ type: "error", text: `Blog #${i + 1}: Choose a valid schedule date and time.` });
        return;
      }
      if (!row.showOnWebsiteBlog && !row.relatedCollegeSlug) {
        setFeedback({ type: "error", text: `Blog #${i + 1}: Select a college for college blog destination.` });
        return;
      }
    }

    setBatchSubmitting(true);
    try {
      const payload = {
        mode: "create" as const,
        items: batchRows.map((row) => ({
          title: row.title.trim(),
          category: row.category,
          contentMdx: row.contentMdx.trim(),
          tags: row.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          showOnWebsiteBlog: row.showOnWebsiteBlog,
          relatedCollegeSlug: row.showOnWebsiteBlog ? undefined : row.relatedCollegeSlug,
          scheduledAt: new Date(row.scheduledAt).toISOString(),
        })),
      };

      const res = await fetch("/api/v1/cms/blogs/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to schedule blogs");

      const created: CalendarBlogPost[] = (json.posts || []).map((p: any) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        category: p.category,
        status: p.status,
        showOnWebsiteBlog: p.showOnWebsiteBlog,
        publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
        authorName: p.author?.name || "Editor",
      }));

      setPosts((prev) => [...created, ...prev]);
      setBatchRows([makeEmptyRow(tomorrowKey, 0), makeEmptyRow(tomorrowKey, 24)]);
      if (created[0]?.publishedAt) {
        const firstDate = new Date(created[0].publishedAt);
        setViewYear(firstDate.getFullYear());
        setViewMonth(firstDate.getMonth());
        setSelectedDay(dateKey(firstDate));
      }
      setActiveView("calendar");
      setFeedback({ type: "success", text: json.message || "All blogs scheduled successfully!" });
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Unable to schedule blogs" });
    } finally {
      setBatchSubmitting(false);
    }
  };

  const handleScheduleDrafts = async () => {
    setFeedback(null);
    const items = Object.entries(draftTimes)
      .filter(([, val]) => Boolean(val))
      .map(([id, val]) => ({ id, scheduledAt: new Date(val).toISOString() }));

    if (items.length === 0) {
      setFeedback({ type: "error", text: "Select a schedule date & time for at least one draft." });
      return;
    }

    setDraftSubmitting(true);
    try {
      const res = await fetch("/api/v1/cms/blogs/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "reschedule", items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to schedule drafts");

      const updatedMap = new Map<string, any>((json.posts || []).map((p: any) => [p.id, p]));
      setPosts((prev) =>
        prev.map((p) => {
          const u = updatedMap.get(p.id);
          if (!u) return p;
          return {
            ...p,
            status: u.status,
            publishedAt: u.publishedAt ? new Date(u.publishedAt).toISOString() : null,
          };
        })
      );
      setDraftTimes({});
      setActiveView("calendar");
      setFeedback({ type: "success", text: json.message || "Drafts scheduled successfully!" });
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to schedule drafts" });
    } finally {
      setDraftSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView("calendar")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${
              activeView === "calendar"
                ? "bg-[#1a3068] text-white shadow-xs"
                : "bg-muted/50 text-foreground hover:bg-muted"
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Full Calendar ({scheduledPosts.length} Scheduled)</span>
          </button>

          {canPublish && (
            <button
              type="button"
              onClick={() => setActiveView("batch")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${
                activeView === "batch"
                  ? "bg-purple-700 text-white shadow-xs"
                  : "bg-muted/50 text-foreground hover:bg-muted"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Write &amp; Schedule Multiple Blogs</span>
            </button>
          )}

          {canPublish && (
            <button
              type="button"
              onClick={() => setActiveView("drafts")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${
                activeView === "drafts"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-muted/50 text-foreground hover:bg-muted"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Schedule Existing Drafts ({draftPosts.length})</span>
            </button>
          )}
        </div>

        <Link
          href={`${basePath}/new?destination=website`}
          className="inline-flex items-center gap-1.5 rounded-xl border bg-background px-3.5 py-2 text-xs font-bold text-foreground hover:bg-accent"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Full Rich Editor (Single)</span>
        </Link>
      </div>

      {feedback && (
        <div
          role="alert"
          className={`rounded-xl border px-4 py-3 text-xs font-semibold flex items-center justify-between gap-2 ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline opacity-80 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* VIEW 1: FULL MONTH CALENDAR */}
      {activeView === "calendar" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <div className="xl:col-span-2 rounded-2xl border bg-card shadow-xs overflow-hidden">
            {/* Calendar Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-5 py-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-foreground">{monthLabel}</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={goPrevMonth}
                  className="p-2 rounded-lg border bg-background hover:bg-accent cursor-pointer"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={goToday}
                  className="px-3 py-1.5 rounded-lg border bg-background hover:bg-accent text-xs font-bold cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={goNextMonth}
                  className="p-2 rounded-lg border bg-background hover:bg-accent cursor-pointer"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 border-b px-5 py-2 text-[11px] font-semibold text-muted-foreground bg-background">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600" /> Scheduled (auto-publishes at time)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Published
              </span>
            </div>

            {/* Weekday Header */}
            <div className="grid grid-cols-7 border-b bg-muted/20 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {WEEKDAYS.map((day) => (
                <div key={day} className="py-2.5">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 divide-x divide-y border-b">
              {calendarDays.map((cell) => {
                const dayPosts = postsByDay.get(cell.key) || [];
                const isToday = cell.key === dateKey(today);
                const isSelected = cell.key === selectedDay;

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedDay(cell.key)}
                    className={`min-h-[96px] sm:min-h-[112px] p-2 text-left align-top flex flex-col gap-1 transition-colors cursor-pointer ${
                      !cell.inMonth ? "bg-muted/25 text-muted-foreground/60" : "bg-card hover:bg-muted/30"
                    } ${isSelected ? "ring-2 ring-inset ring-[#1a3068] bg-blue-50/40" : ""}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          isToday
                            ? "bg-[#1a3068] text-white"
                            : cell.inMonth
                            ? "text-foreground"
                            : "text-muted-foreground/60"
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                      {dayPosts.length > 0 && (
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {dayPosts.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 w-full overflow-hidden">
                      {dayPosts.slice(0, 3).map((post) => {
                        const timeLabel = post.publishedAt
                          ? new Date(post.publishedAt).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "";
                        const isScheduled = post.status === "SCHEDULED";
                        return (
                          <div
                            key={post.id}
                            className={`truncate rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              isScheduled
                                ? "bg-purple-100 text-purple-900 border border-purple-200"
                                : "bg-emerald-100 text-emerald-900 border border-emerald-200"
                            }`}
                            title={`${timeLabel} — ${post.title}`}
                          >
                            <span className="font-bold mr-1">{timeLabel}</span>
                            {post.title}
                          </div>
                        );
                      })}
                      {dayPosts.length > 3 && (
                        <div className="text-[10px] font-bold text-primary pl-1">
                          +{dayPosts.length - 3} more
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Selected Day Details & Upcoming Queue */}
          <div className="space-y-5">
            <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-2 border-b pb-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Selected Date
                  </p>
                  <h3 className="text-base font-extrabold text-foreground">
                    {new Date(`${selectedDay}T00:00:00`).toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </h3>
                </div>
                {canPublish && (
                  <button
                    type="button"
                    onClick={addBlogForSelectedDay}
                    className="inline-flex items-center gap-1 rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Schedule here</span>
                  </button>
                )}
              </div>

              {selectedDayPosts.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <CalendarClock className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                  <p className="text-xs text-muted-foreground">
                    No blogs scheduled or published on this date.
                  </p>
                  {canPublish && (
                    <button
                      type="button"
                      onClick={addBlogForSelectedDay}
                      className="text-xs font-bold text-purple-700 hover:underline cursor-pointer"
                    >
                      + Write &amp; schedule a blog for this date
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayPosts.map((post) => {
                    const currentLocalVal =
                      rescheduleValues[post.id] ?? toDateTimeLocalValue(post.publishedAt);
                    const isScheduled = post.status === "SCHEDULED";
                    return (
                      <div
                        key={post.id}
                        className="rounded-xl border p-3.5 space-y-2.5 bg-background"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                                isScheduled
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {post.status}
                            </span>
                            <h4 className="mt-1 font-bold text-xs text-foreground line-clamp-2">
                              {post.title}
                            </h4>
                            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {post.publishedAt
                                ? new Date(post.publishedAt).toLocaleTimeString("en-IN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                              <span>·</span>
                              <span>{post.showOnWebsiteBlog ? "Website" : "College"}</span>
                            </p>
                          </div>
                          <Link
                            href={`${basePath}/${post.id}/edit`}
                            className="p-1.5 rounded-lg border hover:bg-accent text-muted-foreground shrink-0"
                            title="Open full editor"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Link>
                        </div>

                        {canPublish && isScheduled && (
                          <div className="pt-2 border-t space-y-2">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="datetime-local"
                                value={currentLocalVal}
                                onChange={(e) =>
                                  setRescheduleValues((prev) => ({
                                    ...prev,
                                    [post.id]: e.target.value,
                                  }))
                                }
                                className="flex-1 min-w-0 rounded-lg border bg-card px-2 py-1 text-[11px]"
                              />
                              <button
                                type="button"
                                disabled={busyId === post.id || !currentLocalVal}
                                onClick={() =>
                                  handleQuickPatch(
                                    post.id,
                                    {
                                      status: "SCHEDULED",
                                      publishedAt: new Date(currentLocalVal).toISOString(),
                                    },
                                    `Rescheduled "${post.title}".`
                                  )
                                }
                                className="rounded-lg bg-[#1a3068] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#152754] disabled:opacity-50 cursor-pointer"
                              >
                                Save
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={busyId === post.id}
                                onClick={() =>
                                  handleQuickPatch(
                                    post.id,
                                    { status: "PUBLISHED", publishedAt: new Date().toISOString() },
                                    `Published "${post.title}" immediately.`
                                  )
                                }
                                className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                              >
                                Publish now
                              </button>
                              <button
                                type="button"
                                disabled={busyId === post.id}
                                onClick={() =>
                                  handleQuickPatch(
                                    post.id,
                                    { status: "DRAFT", publishedAt: null },
                                    `Moved "${post.title}" back to drafts.`
                                  )
                                }
                                className="rounded-lg border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
                              >
                                Unschedule
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming Scheduled Queue */}
            <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-purple-700" />
                <span>Upcoming Scheduled Queue ({scheduledPosts.length})</span>
              </h3>
              {scheduledPosts.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No upcoming blogs scheduled yet. Use{" "}
                  <strong>Write &amp; Schedule Multiple Blogs</strong> to queue posts across different dates and times.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {scheduledPosts.map((post) => {
                    const d = new Date(post.publishedAt!);
                    return (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => {
                          setViewYear(d.getFullYear());
                          setViewMonth(d.getMonth());
                          setSelectedDay(dateKey(d));
                        }}
                        className="w-full text-left rounded-xl border bg-background p-2.5 hover:border-purple-400 transition-colors cursor-pointer"
                      >
                        <p className="text-xs font-bold text-foreground line-clamp-1">{post.title}</p>
                        <p className="text-[11px] text-purple-700 font-semibold mt-0.5">
                          {d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: WRITE & SCHEDULE MULTIPLE BLOGS AT DIFFERENT TIMES */}
      {activeView === "batch" && canPublish && (
        <div className="space-y-5">
          {/* Auto-spread toolbar */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-700" />
                  <span>Write &amp; Schedule Multiple Blogs at Different Times</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Write multiple articles in one session and assign each blog its own publishing date and time.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setBatchRows((prev) => {
                    const lastTime = prev[prev.length - 1]?.scheduledAt;
                    const nextDate = lastTime ? new Date(lastTime) : new Date();
                    nextDate.setHours(nextDate.getHours() + spreadHours);
                    return [
                      ...prev,
                      {
                        ...makeEmptyRow(tomorrowKey, 0),
                        scheduledAt: toDateTimeLocalValue(nextDate),
                      },
                    ];
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-purple-300 bg-purple-50 px-4 py-2 text-xs font-bold text-purple-800 hover:bg-purple-100 cursor-pointer self-start"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another Blog Row</span>
              </button>
            </div>

            {/* Auto-stagger helper bar */}
            <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/30 p-3.5">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                  Start Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={spreadStart}
                  onChange={(e) => setSpreadStart(e.target.value)}
                  className="rounded-lg border bg-background px-3 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                  Gap Between Each Blog
                </label>
                <select
                  value={spreadHours}
                  onChange={(e) => setSpreadHours(Number(e.target.value))}
                  className="rounded-lg border bg-background px-3 py-1.5 text-xs"
                >
                  <option value={3}>Every 3 hours</option>
                  <option value={6}>Every 6 hours</option>
                  <option value={12}>Every 12 hours</option>
                  <option value={24}>Every 1 day (24 hrs)</option>
                  <option value={48}>Every 2 days</option>
                  <option value={72}>Every 3 days</option>
                  <option value={168}>Every 1 week</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleAutoSpread}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a3068] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#152754] cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Assign Different Times</span>
              </button>
            </div>
          </div>

          {/* Blog Rows */}
          <div className="space-y-4">
            {batchRows.map((row, idx) => (
              <div key={row.key} className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between gap-2 border-b pb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-800 text-xs font-black">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-bold text-foreground">
                      {row.title.trim() || `Blog Post #${idx + 1}`}
                    </h3>
                  </div>
                  {batchRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setBatchRows((prev) => prev.filter((r) => r.key !== row.key))}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                      Blog Title *
                    </label>
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) =>
                        setBatchRows((prev) =>
                          prev.map((r) => (r.key === row.key ? { ...r, title: e.target.value } : r))
                        )
                      }
                      placeholder="e.g. JEE Main 2027 Session 1 Cutoff Analysis"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-purple-800 mb-1">
                      Schedule Date &amp; Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={row.scheduledAt}
                      onChange={(e) =>
                        setBatchRows((prev) =>
                          prev.map((r) =>
                            r.key === row.key ? { ...r, scheduledAt: e.target.value } : r
                          )
                        )
                      }
                      className="w-full rounded-lg border border-purple-300 bg-purple-50/40 px-3 py-2 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                      Category
                    </label>
                    <select
                      value={row.category}
                      onChange={(e) =>
                        setBatchRows((prev) =>
                          prev.map((r) =>
                            r.key === row.key ? { ...r, category: e.target.value } : r
                          )
                        )
                      }
                      className="w-full rounded-lg border bg-background px-3 py-2 text-xs"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                      Destination
                    </label>
                    <select
                      value={row.showOnWebsiteBlog ? "website" : "college"}
                      onChange={(e) =>
                        setBatchRows((prev) =>
                          prev.map((r) =>
                            r.key === row.key
                              ? { ...r, showOnWebsiteBlog: e.target.value === "website" }
                              : r
                          )
                        )
                      }
                      className="w-full rounded-lg border bg-background px-3 py-2 text-xs"
                    >
                      <option value="website">Website Blog (Main /blog page)</option>
                      <option value="college">College Blog (Specific college)</option>
                    </select>
                  </div>

                  {!row.showOnWebsiteBlog && (
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                        Target College *
                      </label>
                      <select
                        value={row.relatedCollegeSlug}
                        onChange={(e) =>
                          setBatchRows((prev) =>
                            prev.map((r) =>
                              r.key === row.key ? { ...r, relatedCollegeSlug: e.target.value } : r
                            )
                          )
                        }
                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs"
                      >
                        <option value="">Select a college…</option>
                        {colleges.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className={row.showOnWebsiteBlog ? "md:col-span-2" : ""}>
                    <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                      Tags (comma separated)
                    </label>
                    <input
                      type="text"
                      value={row.tags}
                      onChange={(e) =>
                        setBatchRows((prev) =>
                          prev.map((r) => (r.key === row.key ? { ...r, tags: e.target.value } : r))
                        )
                      }
                      placeholder="jee-main, admission-2027, odisha"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                    Article Content *
                  </label>
                  <textarea
                    rows={4}
                    value={row.contentMdx}
                    onChange={(e) =>
                      setBatchRows((prev) =>
                        prev.map((r) =>
                          r.key === row.key ? { ...r, contentMdx: e.target.value } : r
                        )
                      )
                    }
                    placeholder="Write the blog article content here (supports plain text, Markdown, or HTML)..."
                    className="w-full rounded-lg border bg-background px-3 py-2 text-xs leading-relaxed"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Sticky Batch Submit Bar */}
          <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-lg">
            <p className="text-xs font-semibold text-muted-foreground">
              Ready to schedule <strong className="text-foreground">{batchRows.length}</strong>{" "}
              blog{batchRows.length === 1 ? "" : "s"} at their individual dates &amp; times.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setBatchRows((prev) => [...prev, makeEmptyRow(tomorrowKey, prev.length * spreadHours)])
                }
                className="rounded-xl border px-3.5 py-2 text-xs font-bold hover:bg-accent cursor-pointer"
              >
                + Add Row
              </button>
              <button
                type="button"
                disabled={batchSubmitting}
                onClick={handleBatchCreateSubmit}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {batchSubmitting
                    ? "Scheduling All…"
                    : `Schedule All ${batchRows.length} Blog${batchRows.length === 1 ? "" : "s"}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: QUICK-SCHEDULE EXISTING DRAFTS */}
      {activeView === "drafts" && canPublish && (
        <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div>
              <h2 className="text-lg font-extrabold text-foreground">
                Schedule Existing Drafts at Different Times
              </h2>
              <p className="text-xs text-muted-foreground">
                Pick a publish date and time for any draft below, then schedule them all in one click.
              </p>
            </div>
            <button
              type="button"
              disabled={draftSubmitting || Object.values(draftTimes).filter(Boolean).length === 0}
              onClick={handleScheduleDrafts}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {draftSubmitting
                  ? "Scheduling…"
                  : `Schedule Selected (${Object.values(draftTimes).filter(Boolean).length})`}
              </span>
            </button>
          </div>

          {draftPosts.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              You have no unscheduled drafts right now.
            </p>
          ) : (
            <div className="divide-y">
              {draftPosts.map((draft) => (
                <div
                  key={draft.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{draft.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {draft.category.replace(/_/g, " ")} ·{" "}
                      {draft.showOnWebsiteBlog ? "Website blog" : "College blog"} · {draft.authorName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="datetime-local"
                      value={draftTimes[draft.id] || ""}
                      min={toDateTimeLocalValue(new Date())}
                      onChange={(e) =>
                        setDraftTimes((prev) => ({ ...prev, [draft.id]: e.target.value }))
                      }
                      className="rounded-lg border bg-background px-3 py-1.5 text-xs"
                    />
                    <Link
                      href={`${basePath}/${draft.id}/edit`}
                      className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
