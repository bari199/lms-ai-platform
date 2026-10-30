import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { s3Client, videoBucket } from "../../config/storage.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

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

export async function getLectureVideoUrl(objectKey: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: videoBucket,
    Key: objectKey,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: 3600,
  });
}

export async function deleteLectureVideo(objectKey: string): Promise<void> {
  if (!objectKey.startsWith("lectures/")) {
    throw new Error("Invalid lecture video object key");
  }

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: videoBucket,
      Key: objectKey,
    }),
  );
}

export async function uploadCourseThumbnail(
  courseId: string,
  file: Express.Multer.File,
): Promise<string> {
  const extension = path.extname(file.originalname).toLowerCase();

  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

  if (!allowedExtensions.includes(extension)) {
    throw new Error("Unsupported thumbnail file extension");
  }

  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error("Only JPEG, PNG, and WebP images are allowed");
  }

  const objectKey = `courses/thumbnails/${courseId}/${randomUUID()}${extension}`;

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

export async function getCourseThumbnailUrl(
  objectKey: string,
): Promise<string> {
  if (!objectKey.startsWith("courses/thumbnails/")) {
    throw new Error("Invalid course thumbnail object key");
  }

  const command = new GetObjectCommand({
    Bucket: videoBucket,
    Key: objectKey,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: 3600,
  });
}

export async function uploadLectureResource(
  lectureId: string,
  file: Express.Multer.File,
): Promise<string> {
  const extension = path.extname(file.originalname).toLowerCase();

  const allowedTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };

  const expectedMimeType = allowedTypes[extension];

  if (!expectedMimeType || file.mimetype !== expectedMimeType) {
    throw new Error("Only valid PDF, PPT, and PPTX files are allowed");
  }

  const objectKey = `lectures/${lectureId}/resources/${randomUUID()}${extension}`;

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

export async function getLectureResourceUrl(
  objectKey: string,
): Promise<string> {
  if (
    !objectKey.startsWith("lectures/") ||
    !objectKey.includes("/resources/")
  ) {
    throw new Error("Invalid lecture resource object key");
  }

  const command = new GetObjectCommand({
    Bucket: videoBucket,
    Key: objectKey,
    ResponseContentDisposition: "attachment",
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: 300,
  });
}
