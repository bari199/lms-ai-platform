import { recommendationQueue } from "./recommendation.queue.js";

const main = async (): Promise<void> => {
  const studentId = process.argv[2];

  if (!studentId) {
    throw new Error(
      "Usage: npx tsx src/jobs/test-recommendation-job.ts <student-uuid>",
    );
  }

  const job = await recommendationQueue.add(
    "recalculate-recommendation-scores",
    { studentId },
    {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    },
  );

  console.log("Recommendation job queued:", job.id);
};

main()
  .catch((error: unknown) => {
    console.error("Failed to queue recommendation job:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await recommendationQueue.close();
  });
