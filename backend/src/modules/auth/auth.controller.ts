import type { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  getCurrentUser,
  refreshAccessToken,
  logoutUser,
} from "./auth.service.js";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";

export async function register(req: Request, res: Response): Promise<Response> {
  try {
    const { name, email, password, role } = req.body ?? {};

    const result = await registerUser({
      fullName: name,
      email,
      password,
      role,
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Registration failed";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}

export async function login(req: Request, res: Response): Promise<Response> {
  try {
    const { email, password } = req.body ?? {};

    const result = await loginUser(email, password);

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/v1/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { refreshToken: _refreshToken, ...safeResult } = result;

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: safeResult,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Login failed";

    return res.status(401).json({
      success: false,
      message,
    });
  }
}

export async function getMe(
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response> {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userId = req.user.id;
    const user = await getCurrentUser(userId);

    return res.status(200).json({
      success: true,
      message: "Authenticated user",
      data: user,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Could not fetch user";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}

export async function refresh(req: Request, res: Response): Promise<Response> {
  try {
    // Step 8: Read refresh token from the HTTP-only cookie.
    const refreshToken = req.cookies?.refreshToken;

    if (typeof refreshToken !== "string" || !refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    const result = await refreshAccessToken(refreshToken);

    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Token refresh failed";

    return res.status(401).json({
      success: false,
      message,
    });
  }
}

export async function logout(req: Request, res: Response): Promise<Response> {
  try {
    // Logout still reads the refresh token from the request body in this step.
    const refreshToken = req.cookies?.refreshToken;

    if (typeof refreshToken !== "string" || !refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    await logoutUser(refreshToken);

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/v1/auth",
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Logout failed";

    return res.status(400).json({
      success: false,
      message,
    });
  }
}
