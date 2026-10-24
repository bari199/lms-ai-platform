import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { pool } from "../../config/db.js";
import { updateStreak } from "./streaks.service.js";
import { awardBadge } from "./badges.service.js";
import * as certificatesService from "./certificates.service.js";

export const getGamificationSummary = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const [streakResult, badgesResult, certificatesResult] = await Promise.all([
      pool.query(
        `SELECT current_streak, longest_streak, last_active_date
           FROM streaks
           WHERE user_id = $1`,
        [userId],
      ),
      pool.query(
        `SELECT b.id, b.name, b.description, ub.earned_at
           FROM user_badges ub
           JOIN badges b ON b.id = ub.badge_id
           WHERE ub.user_id = $1
           ORDER BY ub.earned_at DESC`,
        [userId],
      ),
      pool.query(
        `SELECT id, course_id, certificate_url, issued_at
           FROM certificates
           WHERE user_id = $1
           ORDER BY issued_at DESC`,
        [userId],
      ),
    ]);

    res.status(200).json({
      streak: streakResult.rows[0] ?? {
        current_streak: 0,
        longest_streak: 0,
        last_active_date: null,
      },
      badges: badgesResult.rows,
      certificates: certificatesResult.rows,
    });
  } catch (error) {
    console.error("Get gamification summary error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const recordLearningActivity = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const streak = await updateStreak(userId);

    if (streak.current_streak >= 7) {
      await awardBadge(userId, "7-Day Streak");
    }

    res.status(200).json({
      message: "Learning activity recorded",
      streak,
    });
  } catch (error) {
    console.error("Record learning activity error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


export const downloadCertificateController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user?.id;
  const certificateId = req.params.id;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (!certificateId || Array.isArray(certificateId)) {
    res.status(400).json({ message: "Valid certificate ID is required" });
    return;
  }

  try {
    const certificateService = certificatesService as unknown as {
      getCertificatePdf?: (
        userId: string,
        certificateId: string,
      ) => Promise<{ filename: string; buffer: Buffer } | null>;
    }; 

    if (!certificateService.getCertificatePdf) {
      res.status(500).json({ message: "Failed to download certificate" });
      return;
    }

    const certificate = await certificateService.getCertificatePdf(
      userId,
      certificateId,
    );

    if (!certificate) {
      res.status(404).json({ message: "Certificate not found" });
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${certificate.filename}"`,
    );
    res.setHeader("Content-Length", certificate.buffer.length);

    res.status(200).send(certificate.buffer);
  } catch (error) {
    console.error("Download certificate error:", error);
    res.status(500).json({ message: "Failed to download certificate" });
  }
};
