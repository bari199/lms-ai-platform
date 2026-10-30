import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import axios from "axios";
import api from "@/services/api";

type Module = {
  id: string;
  title: string;
  order_index: number;
};

type Quiz = {
  id: string;
  title: string;
  module_id: string;
  is_ai_generated: boolean;
  approval_status: "pending" | "approved" | "rejected";
  generated_from_lecture_id: string | null;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type QuizOption = {
  option_text: string;
  is_correct: boolean;
};

type QuizQuestion = {
  question_text: string;
  question_type: "mcq" | "multi_select" | "short_answer";
  order_index: number;
  options: QuizOption[];
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }

  if (error instanceof Error) return error.message;

  return fallback;
}

const inputClass =
  "w-full rounded-lg border bg-background px-3 py-2 text-foreground";

const buttonClass =
  "rounded-lg border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50";

export default function InstructorQuizManagementPage() {
  const { id: courseId } = useParams<{ id: string }>();

  const [modules, setModules] = useState<Module[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [title, setTitle] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] =
    useState<QuizQuestion["question_type"]>("mcq");
  const [options, setOptions] = useState<QuizOption[]>([
    { option_text: "", is_correct: true },
    { option_text: "", is_correct: false },
  ]);

  const [loadingModules, setLoadingModules] = useState(true);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingQuizId, setUpdatingQuizId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadModules = useCallback(async () => {
    if (!courseId) {
      setError("Course ID is missing.");
      setLoadingModules(false);
      return;
    }

    try {
      const response = await api.get<ApiResponse<{ modules?: Module[] }>>(
        `/courses/${courseId}/manage`,
      );

      if (!response.data?.success) {
        throw new Error("Failed to load course modules.");
      }

      const loadedModules = [...(response.data.data?.modules ?? [])].sort(
        (a, b) => a.order_index - b.order_index,
      );

      setModules(loadedModules);
      setSelectedModuleId((current) =>
        loadedModules.some((module) => module.id === current)
          ? current
          : (loadedModules[0]?.id ?? ""),
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load course modules."));
    } finally {
      setLoadingModules(false);
    }
  }, [courseId]);

  const loadQuizzes = useCallback(async () => {
    try {
      const response = await api.get<ApiResponse<Quiz[]>>(
        "/quizzes/instructor",
      );

      if (!response.data?.success) {
        throw new Error("Failed to load quizzes.");
      }

      setQuizzes(response.data.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load quizzes."));
    } finally {
      setLoadingQuizzes(false);
    }
  }, []);

  useEffect(() => {
    void loadModules();
    void loadQuizzes();
  }, [loadModules, loadQuizzes]);

  function clearNotifications() {
    setError("");
    setMessage("");
  }

  function handleQuestionTypeChange(nextType: QuizQuestion["question_type"]) {
    setQuestionType(nextType);

    if (nextType !== "short_answer" && options.length < 2) {
      setOptions([
        { option_text: "", is_correct: true },
        { option_text: "", is_correct: false },
      ]);
    }

    clearNotifications();
  }

  function updateOption(
    index: number,
    field: "option_text" | "is_correct",
    value: string | boolean,
  ) {
    setOptions((current) =>
      current.map((option, optionIndex) => {
        if (optionIndex !== index) return option;

        if (field === "option_text") {
          return { ...option, option_text: value as string };
        }

        return { ...option, is_correct: value as boolean };
      }),
    );
  }

  function addOption() {
    setOptions((current) => [
      ...current,
      { option_text: "", is_correct: false },
    ]);
  }

  function removeOption(index: number) {
    setOptions((current) =>
      current.filter((_, optionIndex) => optionIndex !== index),
    );
  }

  async function handleCreateQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearNotifications();

    if (submitting) return;

    if (!selectedModuleId) {
      setError("Select a module before creating a quiz.");
      return;
    }

    const cleanTitle = title.trim();
    const cleanQuestion = questionText.trim();

    if (!cleanTitle || !cleanQuestion) {
      setError("Enter both a quiz title and a question.");
      return;
    }

    let questionOptions: QuizOption[] = [];

    if (questionType !== "short_answer") {
      questionOptions = options.map((option) => ({
        option_text: option.option_text.trim(),
        is_correct: option.is_correct,
      }));

      if (
        questionOptions.length < 2 ||
        questionOptions.some((option) => !option.option_text) ||
        new Set(questionOptions.map((option) => option.option_text)).size !==
          questionOptions.length ||
        !questionOptions.some((option) => option.is_correct)
      ) {
        setError(
          "Add at least two unique, non-empty options and mark a correct answer.",
        );
        return;
      }

      if (
        questionType === "mcq" &&
        questionOptions.filter((option) => option.is_correct).length !== 1
      ) {
        setError(
          "Multiple-choice questions must have exactly one correct option.",
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      const response = await api.post<ApiResponse<Quiz>>("/quizzes/", {
        module_id: selectedModuleId,
        title: cleanTitle,
        questions: [
          {
            question_text: cleanQuestion,
            question_type: questionType,
            order_index: 1,
            options: questionOptions,
          },
        ],
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || "Quiz creation failed.");
      }

      setTitle("");
      setQuestionText("");
      setQuestionType("mcq");
      setOptions([
        { option_text: "", is_correct: true },
        { option_text: "", is_correct: false },
      ]);
      setMessage("Quiz created successfully.");

      await loadQuizzes();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create quiz."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprovalChange(
    quizId: string,
    approvalStatus: "approved" | "rejected",
  ) {
    clearNotifications();
    setUpdatingQuizId(quizId);

    try {
      const response = await api.patch<ApiResponse<Quiz>>(
        `/quizzes/${quizId}/approval`,
        { approval_status: approvalStatus },
      );

      if (!response.data?.success) {
        throw new Error(response.data?.message || "Quiz status update failed.");
      }

      setQuizzes((current) =>
        current.map((quiz) =>
          quiz.id === quizId
            ? { ...quiz, approval_status: approvalStatus }
            : quiz,
        ),
      );

      setMessage(`Quiz ${approvalStatus} successfully.`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update quiz status."));
    } finally {
      setUpdatingQuizId("");
    }
  }

  const courseQuizzes = quizzes.filter((quiz) =>
    modules.some((module) => module.id === quiz.module_id),
  );

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link
          to="/instructor/courses"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to My Courses
        </Link>

        <header>
          <h1 className="mt-4 text-3xl font-bold">Quiz Management</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create quizzes for your course and manage their approval status.
          </p>
          {courseId && (
            <p className="mt-1 break-all text-xs text-muted-foreground">
              Course ID: {courseId}
            </p>
          )}
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

        <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Create a Manual Quiz</h2>

          {loadingModules ? (
            <p>Loading course modules...</p>
          ) : modules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No modules found. Create a module in Course Content Manager first.
            </p>
          ) : (
            <form onSubmit={handleCreateQuiz} className="space-y-5">
              <div>
                <label htmlFor="quiz-module" className="mb-2 block font-medium">
                  Course module
                </label>
                <select
                  id="quiz-module"
                  required
                  value={selectedModuleId}
                  onChange={(event) => setSelectedModuleId(event.target.value)}
                  className={inputClass}
                >
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.order_index}. {module.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="quiz-title" className="mb-2 block font-medium">
                  Quiz title
                </label>
                <input
                  id="quiz-title"
                  required
                  maxLength={200}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Introduction Quiz"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="quiz-question"
                  className="mb-2 block font-medium"
                >
                  Question 1
                </label>
                <textarea
                  id="quiz-question"
                  required
                  maxLength={5000}
                  rows={3}
                  value={questionText}
                  onChange={(event) => setQuestionText(event.target.value)}
                  placeholder="Enter your question"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="quiz-question-type"
                  className="mb-2 block font-medium"
                >
                  Question type
                </label>
                <select
                  id="quiz-question-type"
                  value={questionType}
                  onChange={(event) =>
                    handleQuestionTypeChange(
                      event.target.value as QuizQuestion["question_type"],
                    )
                  }
                  className={inputClass}
                >
                  <option value="mcq">
                    Multiple choice (one correct answer)
                  </option>
                  <option value="multi_select">
                    Multi-select (multiple correct answers)
                  </option>
                  <option value="short_answer">Short answer</option>
                </select>
              </div>

              {questionType !== "short_answer" && (
                <div className="space-y-3">
                  <h3 className="font-medium">Answer options</h3>
                  <p className="text-sm text-muted-foreground">
                    {questionType === "mcq"
                      ? "Select exactly one correct answer."
                      : "Select one or more correct answers."}
                  </p>

                  {options.map((option, index) => (
                    <div
                      key={index}
                      className="space-y-2 rounded-lg border p-3"
                    >
                      <label
                        htmlFor={`quiz-option-${index}`}
                        className="text-sm font-medium"
                      >
                        Option {index + 1}
                      </label>

                      <input
                        id={`quiz-option-${index}`}
                        required
                        maxLength={1000}
                        value={option.option_text}
                        onChange={(event) =>
                          updateOption(index, "option_text", event.target.value)
                        }
                        placeholder={`Enter option ${index + 1}`}
                        className={inputClass}
                      />

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type={questionType === "mcq" ? "radio" : "checkbox"}
                          name="correct-option"
                          checked={option.is_correct}
                          onChange={() => {
                            if (questionType === "mcq") {
                              setOptions((current) =>
                                current.map((item, optionIndex) => ({
                                  ...item,
                                  is_correct: optionIndex === index,
                                })),
                              );
                            } else {
                              updateOption(
                                index,
                                "is_correct",
                                !option.is_correct,
                              );
                            }
                          }}
                        />
                        Correct answer
                      </label>

                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="text-sm text-destructive hover:underline"
                        >
                          Remove option
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addOption}
                    className={buttonClass}
                  >
                    + Add option
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || loadingModules || modules.length === 0}
                className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-50"
              >
                {submitting ? "Creating quiz..." : "Create Quiz"}
              </button>
            </form>
          )}
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5 sm:p-6">
          <div>
            <h2 className="text-xl font-semibold">Existing Quizzes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Showing quizzes belonging to this course.
            </p>
          </div>

          {loadingQuizzes || loadingModules ? (
            <p>Loading quizzes...</p>
          ) : courseQuizzes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No quizzes found for this course yet.
            </p>
          ) : (
            <div className="space-y-3">
              {courseQuizzes.map((quiz) => {
                const module = modules.find(
                  (item) => item.id === quiz.module_id,
                );

                return (
                  <article
                    key={quiz.id}
                    className="space-y-3 rounded-lg border p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold">
                          {quiz.title}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Module: {module?.title ?? "Unknown module"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Type:{" "}
                          {quiz.is_ai_generated ? "AI generated" : "Manual"}
                        </p>
                      </div>

                      <span className="rounded-full border px-3 py-1 text-xs capitalize">
                        {quiz.approval_status}
                      </span>
                    </div>

                    {quiz.approval_status === "pending" && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={updatingQuizId === quiz.id}
                          onClick={() =>
                            void handleApprovalChange(quiz.id, "approved")
                          }
                          className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                        >
                          {updatingQuizId === quiz.id
                            ? "Updating..."
                            : "Approve"}
                        </button>

                        <button
                          type="button"
                          disabled={updatingQuizId === quiz.id}
                          onClick={() =>
                            void handleApprovalChange(quiz.id, "rejected")
                          }
                          className="rounded-lg border border-destructive px-3 py-2 text-sm text-destructive disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {quiz.approval_status !== "pending" && (
                      <button
                        type="button"
                        disabled={updatingQuizId === quiz.id}
                        onClick={() =>
                          void handleApprovalChange(
                            quiz.id,
                            quiz.approval_status === "approved"
                              ? "rejected"
                              : "approved",
                          )
                        }
                        className={buttonClass}
                      >
                        Change to{" "}
                        {quiz.approval_status === "approved"
                          ? "Rejected"
                          : "Approved"}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
