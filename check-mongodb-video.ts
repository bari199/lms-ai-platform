import dotenv from "dotenv";
import path from "node:path";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3Client, videoBucket } from "./src/config/storage.js";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

async function main() {
  const prefix = "lectures/46106922-a2f1-409d-9b7a-98e870bdbc2d/";

  try {
    const result = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: videoBucket,
        Prefix: prefix,
      }),
    );

    console.log("Bucket:", videoBucket);
    console.log("Lecture prefix:", prefix);
    console.table(
      (result.Contents ?? []).map((object) => ({
        Key: object.Key,
        SizeMB: object.Size ? (object.Size / 1024 / 1024).toFixed(2) : "0",
      })),
    );
    console.log("Objects found:", result.KeyCount ?? 0);
  } finally {
    s3Client.destroy();
  }
}

main().catch((error) => {
  console.error("MinIO listing failed:", error);
  process.exitCode = 1;
});
