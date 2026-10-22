import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { s3Client, videoBucket } from "../../config/storage.js";

export async function uploadLectureVideo(
  lectureId: string,
  file: Express.Multer.File,
): Promise<string> {
  const extension = path.extname(file.originalname).toLowerCase();

  const allowedExtensions = [".mp4", ".webm", ".mov", ".m4v"];

  if (!allowedExtensions.includes(extension)) {
    throw new Error("Unsupported video file extension");
  }

  if (!file.mimetype.startsWith("video/")) {
    throw new Error("Only video files are allowed");
  }

  const objectKey = `lectures/${lectureId}/${randomUUID()}${extension}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: videoBucket,
      Key: objectKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentLength: file.size,
    }),
  );

  return objectKey;
}
