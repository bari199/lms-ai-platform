import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import api from "@/services/api";

interface QuizResult {
  attempt_id: string;
  quiz_id: string;
  quiz_title: string;
  score: number | null;
  started_at: string;
  submitted_at: string | null;
}

export default function QuizResultPage() {
  const { attemptId } = useParams();

  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchResult() {
      if (!attemptId) {
        setError("Invalid quiz attempt.");
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(
          `/quizzes/attempts/${attemptId}/results`,
        );

        setResult(response.data?.data ?? null);
      } catch (err) {
        console.error("Fetch quiz result failed:", err);
        setError("Could not load quiz result.");
      } finally {
        setLoading(false);
      }
    }

    void fetchResult();
  }, [attemptId]);

  if (loading) {
    return <main className="p-8 text-center">Loading result...</main>;
  }

  if (error || !result) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-destructive">{error || "Result not found."}</p>
        <Link to="/my-courses" className="mt-4 inline-block underline">
          Back to My Courses
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-2xl rounded-xl border bg-card p-8 text-center">
        <h1 className="text-3xl font-bold">Quiz Result</h1>

        <h2 className="mt-4 text-xl font-semibold">{result.quiz_title}</h2>

        <div className="my-8 rounded-xl bg-muted p-6">
          <p className="text-sm text-muted-foreground">Your Score</p>
          <p className="mt-2 text-4xl font-bold">
            {result.score === null ? "Pending" : result.score}
          </p>
          {result.score === null && (
            <p className="mt-2 text-sm text-muted-foreground">
              Your short-answer responses may require manual evaluation.
            </p>
          )}
        </div>

        <div className="space-y-2 text-left text-sm">
          <p>
            <strong>Started:</strong>{" "}
            {new Date(result.started_at).toLocaleString()}
          </p>
          <p>
            <strong>Submitted:</strong>{" "}
            {result.submitted_at
              ? new Date(result.submitted_at).toLocaleString()
              : "Not submitted"}
          </p>
        </div>

        <Link
          to="/my-courses"
          className="mt-8 inline-block rounded-lg bg-primary px-5 py-3 text-primary-foreground"
        >
          Back to My Courses
        </Link>
      </div>
    </main>
  );
}
