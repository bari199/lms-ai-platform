import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import {
  getAdminUsersController,
  updateUserRoleController,
  suspendUserController,
  getPendingCoursesController,
  getAdminAnalyticsController,
} from "./admin.controller.js";

const router = Router();

router.use(authenticateToken, requireRole("admin"));

router.get("/users", getAdminUsersController);

router.put("/users/:id/role", updateUserRoleController);

router.put("/users/:id/suspend", suspendUserController);

router.get("/courses/pending", getPendingCoursesController);

router.get("/analytics/overview", getAdminAnalyticsController);

export default router;
