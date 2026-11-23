export function portalDestination(role: string, managedCollegeId?: string | null, callback?: string | null) {
  const home = role === "STUDENT" ? "/student" : role === "COLLEGE_ADMIN" ? managedCollegeId ? `/partner/${managedCollegeId}` : "/" : "/admin";
  const safe = callback?.startsWith("/") && !callback.startsWith("//") && !callback.includes("\\") && !/[\u0000-\u001f\u007f]/.test(callback) ? callback : null;
  if (!safe || /^\/(login|register|api)(\/|\?|#|$)/.test(safe)) return home;
  if (role === "STUDENT" && (/^\/(admin|partner)(\/|\?|$)/.test(safe))) return home;
  if (role !== "STUDENT" && /^\/student(\/|\?|$)/.test(safe)) return home;
  if (role === "COLLEGE_ADMIN" && /^\/admin(\/|\?|$)/.test(safe)) return home;
  return safe;
}
