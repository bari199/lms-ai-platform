import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import api from "@/services/api";

interface QuizOption {
  id: string;
  option_text: string;
}

interface QuizQuestion {
  id: string;
  question_text: string;
  question_type: "mcq" | "multi_select" | "short_answer";
  order_index: number;
  options: QuizOption[];
}

interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
}

interface QuizAnswer {
  question_id: string;
  selected_option_ids?: string[];
  text_answer?: string;
}

export default function QuizAttemptPage() {
  const { id: quizId } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function startQuiz() {
    if (!quizId) return;

    setLoading(true);
    setError("");

    try {
      const attemptResponse = await api.post(
        `/quizzes/${quizId}/attempt`,
      );

      const attemptId = attemptResponse.data?.data?.id;

      if (!attemptId) {
        throw new Error("Could not start quiz attempt.");
      }

      const quizResponse = await api.get(`/quizzes/${quizId}`);
      const quizData = quizResponse.data?.data;

      if (!quizData || !Array.isArray(quizData.questions)) {
        throw new Error("Invalid quiz response.");
      }

      setQuiz(quizData);
      setAnswers(
        Object.fromEntries(
          quizData.questions.map((question: QuizQuestion) => [
            question.id,
            {
              question_id: question.id,
              selected_option_ids: [],
              text_answer: "",
            },
          ]),
        ),
      );

      sessionStorage.setItem("activeQuizAttemptId", attemptId);
    } catch (err) {
      console.error("Start quiz failed:", err);
      setError("Could not start this quiz. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function selectOption(
    question: QuizQuestion,
    optionId: string,
  ) {
    setAnswers((current) => {
      const existing = current[question.id]?.selected_option_ids ?? [];

      const selected =
        question.question_type === "multi_select"
          ? existing.includes(optionId)
            ? existing.filter((id) => id !== optionId)
            : [...existing, optionId]
          : [optionId];

      return {
        ...current,
        [question.id]: {
          question_id: question.id,
          selected_option_ids: selected,
        },
      };
    });
  }

  function updateTextAnswer(questionId: string, value: string) {
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        question_id: questionId,
        text_answer: value,
      },
    }));
  }

  async function submitQuiz() {
    const attemptId = sessionStorage.getItem("activeQuizAttemptId");

    if (!attemptId || !quiz) {
      setError("Quiz attempt not found. Please restart the quiz.");
      return;
    }

    const payload = quiz.questions.map((question) => {
      const answer = answers[question.id];

      return {
        question_id: question.id,
        ...(question.question_type === "short_answer"
          ? { text_answer: answer?.text_answer ?? "" }
          : {
              selected_option_ids:
                answer?.selected_option_ids ?? [],
            }),
      };
    });

    setSubmitting(true);
    setError("");

    try {
      const response = await api.post(
        `/quizzes/attempts/${attemptId}/submit`,
        { answers: payload },
      );

      sessionStorage.removeItem("activeQuizAttemptId");

      navigate(`/quizzes/attempts/${attemptId}/results`, {
        state: response.data?.data,
      });
    } catch (err) {
      console.error("Submit quiz failed:", err);
      setError("Could not submit quiz. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!quiz) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Link to="/my-courses" className="text-sm underline">
          Back to My Courses
        </Link>

        <h1 className="mt-6 text-2xl font-bold">Start Quiz</h1>

        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={() => void startQuiz()}
          className="mt-5 rounded-lg bg-primary px-5 py-3 text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Starting..." : "Start Quiz"}
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">{quiz.title}</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Total Questions: {quiz.questions.length}
        </p>

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-8 space-y-6">
          {quiz.questions.map((question, index) => (
            <section
              key={question.id}
              className="rounded-xl border bg-card p-5"
            >
              <h2 className="font-semibold">
                {index + 1}. {question.question_text}
              </h2>

              {question.question_type === "short_answer" ? (
                <textarea
                  rows={4}
                  value={answers[question.id]?.text_answer ?? ""}
                  onChange={(event) =>
                    updateTextAnswer(question.id, event.target.value)
                  }
                  placeholder="Write your answer..."
                  className="mt-4 w-full rounded-lg border bg-background p-3"
                />
              ) : (
                <div className="mt-4 space-y-3">
                  {question.options.map((option) => {
                    const selected =
                      answers[question.id]?.selected_option_ids ?? [];

                    return (
                      <label
                        key={option.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                      >
                        <input
                          type={
                            question.question_type === "multi_select"
                              ? "checkbox"
                              : "radio"
                          }
                          name={question.id}
                          checked={selected.includes(option.id)}
                          onChange={() => selectOption(question, option.id)}
                        />

                        <span>{option.option_text}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={() => void submitQuiz()}
          className="mt-8 w-full rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Quiz"}
        </button>
      </div>
    </main>
  );
}