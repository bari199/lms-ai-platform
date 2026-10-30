import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.middleware.js";

export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authenticatedReq = req as AuthenticatedRequest;
    console.log("[ROLE DEBUG] User:", authenticatedReq.user);
    console.log("[ROLE DEBUG] Allowed roles:", allowedRoles);

    if (!authenticatedReq.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const hasRole = authenticatedReq.user.roles.some((role) =>
      allowedRoles.includes(role),
    );
    console.log("[ROLE DEBUG] hasRole result:", hasRole);

    if (!hasRole) {
      console.log("[ROLE DEBUG] hasRole:", hasRole);
      res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
      return;
    }

    next();
  };
};
