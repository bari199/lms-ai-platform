import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";

import {
  suspendUser,
  getAdminUsers,
  getAdminAnalytics,
  getPendingCourses,
  updateUserRole,
  type AdminRole,
  type RoleAction,
} from "./admin.service.js";

const allowedRoles: AdminRole[] = ["student", "instructor", "admin"];

const allowedActions: RoleAction[] = ["assign", "revoke"];

const isValidUserId = (userId: unknown): userId is string =>
  typeof userId === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    userId,
  );

export const getAdminUsersController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const search = req.query.search;

  if (search !== undefined && typeof search !== "string") {
    res.status(400).json({
      success: false,
      message: "Search must be a string",
    });
    return;
  }

  try {
    const users = await getAdminUsers(search);

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error("Failed to fetch admin users:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

export const updateUserRoleController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId: unknown = req.params.id;
  const body = req.body ?? {};
  const role: unknown = body.role;
  const action: unknown = body.action;

  if (!isValidUserId(userId)) {
    res.status(400).json({
      success: false,
      message: "A valid user ID is required",
    });
    return;
  }

  if (
    typeof role !== "string" ||
    !allowedRoles.includes(role as AdminRole) ||
    typeof action !== "string" ||
    !allowedActions.includes(action as RoleAction)
  ) {
    res.status(400).json({
      success: false,
      message: "Provide a valid role and action",
      allowedRoles,
      allowedActions,
    });
    return;
  }

  try {
    await updateUserRole(userId, role as AdminRole, action as RoleAction);

    res.status(200).json({
      success: true,
      message: `Role ${action} successful`,
      data: {
        userId,
        role,
        action,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "USER_NOT_FOUND") {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      if (error.message === "ROLE_NOT_FOUND") {
        res.status(500).json({
          success: false,
          message: "Role is missing from the database",
        });
        return;
      }

      if (error.message === "CANNOT_REVOKE_LAST_ADMIN") {
        res.status(409).json({
          success: false,
          message: "Cannot revoke the last admin role",
        });
        return;
      }
    }

    console.error("Failed to update user role:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update user role",
    });
  }
};

export const suspendUserController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId: unknown = req.params.id;

  if (!isValidUserId(userId)) {
    res.status(400).json({
      success: false,
      message: "A valid user ID is required",
    });
    return;
  }

  try {
    const suspended = await suspendUser(userId);

    if (!suspended) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "User suspended successfully",
      data: {
        userId,
        is_active: false,
      },
    });
  } catch (error) {
    console.error("Failed to suspend user:", error);

    res.status(500).json({
      success: false,
      message: "Failed to suspend user",
    });
  }
};

export const getPendingCoursesController = async (
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const courses = await getPendingCourses();

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    console.error("Failed to fetch pending courses:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch pending courses",
    });
  }
};

export const getAdminAnalyticsController = async (
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const analytics = await getAdminAnalytics();

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error("Failed to fetch admin analytics:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch admin analytics",
    });
  }
};
