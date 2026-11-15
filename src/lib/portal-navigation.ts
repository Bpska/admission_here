export function portalDestination(role: string, managedCollegeId?: string | null, callback?: string | null) {
  const home = role === "STUDENT" ? "/student" : role === "COLLEGE_ADMIN" && managedCollegeId ? `/partner/${managedCollegeId}` : "/admin";
  const safe = callback?.startsWith("/") && !callback.startsWith("//") && !callback.includes("\\") && !/[\r\n]/.test(callback) ? callback : null;
  if (!safe || safe.startsWith("/login") || safe.startsWith("/api/")) return home;
  if (role === "STUDENT" && (/^\/(admin|partner)(\/|\?|$)/.test(safe))) return home;
  if (role !== "STUDENT" && /^\/student(\/|\?|$)/.test(safe)) return home;
  if (role === "COLLEGE_ADMIN" && /^\/admin(\/|\?|$)/.test(safe)) return home;
  return safe;
}
