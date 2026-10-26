import dotenv from "dotenv";
import path from "node:path";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { s3Client, videoBucket } from "./src/config/storage.js";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

async function main() {
  console.log("Bucket:", videoBucket);
  console.log("S3 endpoint configured:", Boolean(process.env.S3_ENDPOINT));
  console.log("Access key configured:", Boolean(process.env.S3_ACCESS_KEY));
  console.log("Secret key configured:", Boolean(process.env.S3_SECRET_KEY));

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: videoBucket }));
    console.log("Bucket access: OK");
  } catch (error) {
    console.error(
      "Bucket check failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  }
}

main().finally(() => s3Client.destroy());
