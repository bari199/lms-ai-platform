import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

async function main() {
  const { HeadBucketCommand } = await import("@aws-sdk/client-s3");
  const { s3Client, videoBucket } = await import("../src/config/storage.js");

  console.log("Bucket:", videoBucket);

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: videoBucket }));
    console.log("Bucket access: OK");
  } catch (error) {
    console.error(
      "Bucket check failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  } finally {
    s3Client.destroy();
  }
}

main();
