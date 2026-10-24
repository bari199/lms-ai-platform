import { PutObjectCommand } from "@aws-sdk/client-s3";
import PDFDocument from "pdfkit";
import { randomUUID } from "node:crypto";
import { pool } from "../../config/db.js";
import { s3Client, videoBucket } from "../../config/storage.js";
import { awardBadge } from "./badges.service.js";

interface CertificateDetails {
  user_id: string;
  course_id: string;
  student_name: string;
  course_title: string;
}

export async function issueCourseCertificate(
  userId: string,
  courseId: string,
): Promise<{ id: string; certificate_url: string } | null> {
  const detailsResult = await pool.query<CertificateDetails>(
    `SELECT
       e.student_id AS user_id,
       c.id AS course_id,
       u.full_name AS student_name,
       c.title AS course_title
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     JOIN users u ON u.id = e.student_id
     WHERE e.student_id = $1
       AND e.course_id = $2
       AND e.progress_percentage = 100
       AND e.completed_at IS NOT NULL
       AND c.status = 'approved'`,
    [userId, courseId],
  );

  const details = detailsResult.rows[0];

  if (!details) {
    return null;
  }

  // Return the existing certificate if one has already been issued.
  const existingResult = await pool.query<{
    id: string;
    certificate_url: string;
  }>(
    `SELECT id, certificate_url
     FROM certificates
     WHERE user_id = $1 AND course_id = $2`,
    [userId, courseId],
  );

  if (existingResult.rows[0]?.certificate_url) {
    return existingResult.rows[0];
  }

  const document = new PDFDocument({ size: "A4", layout: "landscape" });
  const chunks: Buffer[] = [];

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document.fontSize(28).text("Certificate of Completion", {
      align: "center",
    });
    document.moveDown(1.5);
    document.fontSize(16).text("This certificate is awarded to", {
      align: "center",
    });
    document.moveDown(0.5);
    document.fontSize(24).text(details.student_name, {
      align: "center",
    });
    document.moveDown(0.5);
    document.fontSize(16).text("for successfully completing", {
      align: "center",
    });
    document.moveDown(0.5);
    document.fontSize(22).text(details.course_title, {
      align: "center",
    });
    document.moveDown(2);
    document
      .fontSize(10)
      .text(`Issued on ${new Date().toISOString().slice(0, 10)}`, {
        align: "center",
      });

    document.end();
  });

  const objectKey = `certificates/${userId}/${courseId}/${randomUUID()}.pdf`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: videoBucket,
      Key: objectKey,
      Body: pdfBuffer,
      ContentType: "application/pdf",
      ContentLength: pdfBuffer.length,
    }),
  );

  const insertResult = await pool.query<{
    id: string;
    certificate_url: string;
  }>(
    `INSERT INTO certificates (user_id, course_id, certificate_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, course_id) DO NOTHING
     RETURNING id, certificate_url`,
    [userId, courseId, objectKey],
  );

  if (insertResult.rows[0]) {
    const completedCount = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM certificates
       WHERE user_id = $1`,
      [userId],
    );

    if (Number(completedCount.rows[0]?.count) === 1) {
      await awardBadge(userId, "First Course Completed");
    }

    return insertResult.rows[0];
  }

  const concurrentResult = await pool.query<{
    id: string;
    certificate_url: string;
  }>(
    `SELECT id, certificate_url
     FROM certificates
     WHERE user_id = $1 AND course_id = $2`,
    [userId, courseId],
  );

  return concurrentResult.rows[0] ?? null;
}
