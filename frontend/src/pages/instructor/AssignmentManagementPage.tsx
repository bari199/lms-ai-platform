import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import axios from "axios";
import api from "@/services/api";

type Assignment = {
  id: string;
  course_id: string;
  title: string;
  instructions: string | null;
  rubric: Record<string, unknown> | null;
  due_date: string | null;
};

type Submission = {
  id: string;
  assignment_id: string;
  user_id: string;
  file_url: string;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }

  if (error instanceof Error) return error.message;
  return fallback;
}

export default function AssignmentManagementPage() {
  const { id: courseId } = useParams<{ id: string }>();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [rubricText, setRubricText] = useState('{\n  "criteria": []\n}');
  const [dueDate, setDueDate] = useState("");

  const [grades, setGrades] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadAssignments() {
    if (!courseId) return;

    const response = await api.get<ApiResponse<Assignment[]>>(
      `/assignments/courses/${courseId}`,
    );

    if (!response.data.success) {
      throw new Error(response.data.message || "Failed to load assignments.");
    }

    const items = response.data.data ?? [];
    setAssignments(items);

    setSelectedAssignmentId((current) =>
      items.some((item) => item.id === current) ? current : "",
    );
  }

  async function loadSubmissions(assignmentId: string) {
    setLoadingSubmissions(true);
    setError("");
    setSubmissions([]);

    try {
      const response = await api.get<ApiResponse<Submission[]>>(
        `/assignments/${assignmentId}/submissions`,
      );

      if (!response.data.success) {
        throw new Error(response.data.message || "Failed to load submissions.");
      }

      const items = response.data.data ?? [];
      setSubmissions(items);

      setGrades(
        Object.fromEntries(
          items.map((item) => [
            item.id,
            item.grade == null ? "" : String(item.grade),
          ]),
        ),
      );

      setFeedbacks(
        Object.fromEntries(items.map((item) => [item.id, item.feedback ?? ""])),
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load submissions."));
    } finally {
      setLoadingSubmissions(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await loadAssignments();
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Failed to load assignments."));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (selectedAssignmentId) {
      void loadSubmissions(selectedAssignmentId);
    } else {
      setSubmissions([]);
    }
  }, [selectedAssignmentId]);

  async function handleCreateAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseId || loading) return;

    setError("");
    setMessage("");

    let rubric: Record<string, unknown>;

    try {
      const parsed: unknown = JSON.parse(rubricText);

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new Error("Rubric must be a JSON object.");
      }

      rubric = parsed as Record<string, unknown>;
    } catch {
      setError("Enter a valid JSON object for the rubric.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post<ApiResponse<Assignment>>(
        `/assignments/courses/${courseId}`,
        {
          title: title.trim(),
          instructions: instructions.trim(),
          rubric,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
        },
      );

      if (!response.data.success) {
        throw new Error(response.data.message || "Assignment creation failed.");
      }

      setTitle("");
      setInstructions("");
      setRubricText('{\n  "criteria": []\n}');
      setDueDate("");

      await loadAssignments();

      setMessage("Assignment created successfully.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create assignment."));
    } finally {
      setLoading(false);
    }
  }

  async function handleGradeSubmission(
    event: FormEvent<HTMLFormElement>,
    submission: Submission,
  ) {
    event.preventDefault();
    if (loading) return;

    const grade = Number(grades[submission.id]);

    if (
      grades[submission.id]?.trim() === "" ||
      !Number.isFinite(grade) ||
      grade < 0 ||
      grade > 100
    ) {
      setError("Enter a grade between 0 and 100.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await api.patch<ApiResponse<Submission>>(
        `/assignments/submissions/${submission.id}/grade`,
        {
          grade,
          feedback: feedbacks[submission.id] ?? "",
        },
      );

      if (!response.data.success) {
        throw new Error(response.data.message || "Grading failed.");
      }

      setMessage("Grade and feedback saved successfully.");

      if (selectedAssignmentId) {
        await loadSubmissions(selectedAssignmentId);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save grade."));
    } finally {
      setLoading(false);
    }
  }

  if (!courseId) {
    return <main className="p-6">Course ID is missing.</main>;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link
          to="/instructor/courses"
          className="text-sm text-muted-foreground underline"
        >
          Back to My Courses
        </Link>

        <header>
          <h1 className="text-3xl font-bold">Assignment Management</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create assignments, review submissions, and provide grades and
            feedback.
          </p>
        </header>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive p-3 text-sm"
          >
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="rounded-lg border p-3 text-sm">
            {message}
          </p>
        )}

        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Create Assignment</h2>

          <form onSubmit={handleCreateAssignment} className="space-y-4">
            <div>
              <label
                htmlFor="assignment-title"
                className="mb-2 block font-medium"
              >
                Assignment title
              </label>
              <input
                id="assignment-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={200}
                className="w-full rounded-lg border bg-background px-3 py-2"
                placeholder="Build a REST API"
              />
            </div>

            <div>
              <label
                htmlFor="assignment-instructions"
                className="mb-2 block font-medium"
              >
                Instructions
              </label>
              <textarea
                id="assignment-instructions"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                rows={4}
                className="w-full rounded-lg border bg-background px-3 py-2"
                placeholder="Describe the assignment requirements..."
              />
            </div>

            <div>
              <label
                htmlFor="assignment-rubric"
                className="mb-2 block font-medium"
              >
                Rubric (JSON)
              </label>
              <textarea
                id="assignment-rubric"
                value={rubricText}
                onChange={(event) => setRubricText(event.target.value)}
                rows={5}
                required
                className="w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Example:{" "}
                {'{ "criteria": [{ "name": "Correctness", "points": 100 }] }'}
              </p>
            </div>

            <div>
              <label
                htmlFor="assignment-deadline"
                className="mb-2 block font-medium"
              >
                Deadline (optional)
              </label>
              <input
                id="assignment-deadline"
                type="datetime-local"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            >
              {loading ? "Saving..." : "Create Assignment"}
            </button>
          </form>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Your Assignments</h2>

          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No assignments found. Create your first assignment above.
            </p>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <button
                  key={assignment.id}
                  type="button"
                  onClick={() => setSelectedAssignmentId(assignment.id)}
                  className={`w-full rounded-lg border p-4 text-left ${
                    selectedAssignmentId === assignment.id
                      ? "border-primary bg-primary/5"
                      : ""
                  }`}
                >
                  <span className="block font-medium">{assignment.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Deadline:{" "}
                    {assignment.due_date
                      ? new Date(assignment.due_date).toLocaleString()
                      : "No deadline"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {selectedAssignmentId && (
          <section className="space-y-4 rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold">Student Submissions</h2>

            {loadingSubmissions && <p>Loading submissions...</p>}

            {!loadingSubmissions && submissions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No submissions have been received for this assignment yet.
              </p>
            )}

            {submissions.map((submission) => (
              <article
                key={submission.id}
                className="space-y-4 rounded-lg border p-4"
              >
                <div className="text-sm">
                  <p>
                    <strong>Student ID:</strong> {submission.user_id}
                  </p>
                  <p className="mt-1">
                    <strong>Submitted:</strong>{" "}
                    {new Date(submission.submitted_at).toLocaleString()}
                  </p>
                  <p className="mt-2 break-all">
                    <strong>Stored file key:</strong> {submission.file_url}
                  </p>
                </div>

                <form
                  onSubmit={(event) =>
                    void handleGradeSubmission(event, submission)
                  }
                  className="space-y-3"
                >
                  <div>
                    <label
                      htmlFor={`grade-${submission.id}`}
                      className="mb-1 block font-medium"
                    >
                      Grade (0–100)
                    </label>
                    <input
                      id={`grade-${submission.id}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      required
                      value={grades[submission.id] ?? ""}
                      onChange={(event) =>
                        setGrades((current) => ({
                          ...current,
                          [submission.id]: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border bg-background px-3 py-2"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`feedback-${submission.id}`}
                      className="mb-1 block font-medium"
                    >
                      Feedback
                    </label>
                    <textarea
                      id={`feedback-${submission.id}`}
                      rows={3}
                      value={feedbacks[submission.id] ?? ""}
                      onChange={(event) =>
                        setFeedbacks((current) => ({
                          ...current,
                          [submission.id]: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border bg-background px-3 py-2"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Save Grade & Feedback"}
                  </button>
                </form>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
