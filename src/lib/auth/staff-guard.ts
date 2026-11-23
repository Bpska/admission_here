import { auth } from "@/lib/auth/config";
import { cache } from "react";

export interface AdminAccessResult {
  allowed: boolean;
  isSuperAdmin: boolean;
  role: string;
  userId: string;
  userName: string;
  userDesignation?: string | null;
  userEmail: string;
  permissions: string[];
  assignedCollegeIds?: string[];
}

/**
 * Checks if the current session has permission to access an admin feature.
 * Wrapped in React cache() so multiple components in the same render cycle
 * do not re-execute or re-decode session tokens.
 */
export const checkAdminAccess = cache(async function checkAdminAccess(
  feature?: string,
): Promise<AdminAccessResult> {
  const session = await auth();
  const user = session?.user as any;

  if (!user) {
    return {
      allowed: false,
      isSuperAdmin: false,
      role: "ANONYMOUS",
      userId: "",
      userName: "",
      userEmail: "",
      permissions: [],
    };
  }

  const role = user.role || "STUDENT";
  const permissions: string[] = user.permissions || [];
  const userName = user.name || "User";
  const userDesignation = user.designation || null;
  const userEmail = user.email || "";
  const userId = user.id || "00000000-0000-0000-0000-000000000001";

  if (role === "SUPER_ADMIN") {
    return {
      allowed: true,
      isSuperAdmin: true,
      role: "SUPER_ADMIN",
      userId,
      userName,
      userDesignation,
      userEmail,
      permissions: [
        "dashboard",
        "colleges",
        "exams",
        "blogs",
        "reviews",
        "leads",
        "seo-geo",
        "users",
        "staff",
      ],
    };
  }

  if (role === "STAFF") {
    // Staff can never access Staff Management or User Role management
    if (
      !feature ||
      feature === "staff" ||
      feature === "users" ||
      feature === "all"
    ) {
      return {
        allowed: false,
        isSuperAdmin: false,
        role: "STAFF",
        userId,
        userName,
        userDesignation,
        userEmail,
        permissions,
      };
    }

    // Dashboard is always allowed if they are staff
    if (feature === "dashboard") {
      return {
        allowed: true,
        isSuperAdmin: false,
        role: "STAFF",
        userId,
        userName,
        userDesignation,
        userEmail,
        permissions,
        assignedCollegeIds: user.assignedCollegeIds || [],
      };
    }

    // Check specific module
    const allowed = permissions.includes(feature);
    return {
      allowed,
      isSuperAdmin: false,
      role: "STAFF",
      userId,
      userName,
      userDesignation,
      userEmail,
      permissions,
      assignedCollegeIds: user.assignedCollegeIds || [],
    };
  }

  if (role === "AUTHOR") {
    return {
      allowed: feature === "blogs" || feature === "dashboard",
      isSuperAdmin: false,
      role,
      userId,
      userName,
      userDesignation,
      userEmail,
      permissions: ["blogs", "dashboard"],
    };
  }

  return {
    allowed: false,
    isSuperAdmin: false,
    role,
    userId,
    userName,
    userDesignation,
    userEmail,
    permissions: [],
  };
});

export function canAccessCollege(access: AdminAccessResult, collegeId: string) {
  return (
    access.isSuperAdmin ||
    (access.role === "STAFF" &&
      (access.assignedCollegeIds || []).includes(collegeId))
  );
}

export function collegeScope(access: AdminAccessResult) {
  return access.isSuperAdmin
    ? {}
    : { id: { in: access.assignedCollegeIds || [] } };
}
