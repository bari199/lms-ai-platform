import { useState, type FormEvent, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import axios from "axios";
import api from "@/services/api";
import type { RootState } from "@/store";

type CreatedCourse = {
  id?: string;
  course_id?: string;
  title?: string;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export default function CreateCoursePage() {
  const navigate = useNavigate();

  const user = useSelector((state: RootState) => state.auth.user);

  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("beginner");
  const [price, setPrice] = useState("0");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isInstructor = user?.roles?.includes("instructor") ?? false;

  function handleThumbnailChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setError("");
    setSuccess("");

    if (!file) {
      setThumbnail(null);
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setThumbnail(null);
      event.target.value = "";
      setError("Please select a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setThumbnail(null);
      event.target.value = "";
      setError("Thumbnail size must not exceed 5 MB.");
      return;
    }

    setThumbnail(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isInstructor || loading) {
      return;
    }

    setError("");
    setSuccess("");

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const trimmedCategory = category.trim();
    const parsedPrice = Number(price);

    if (!trimmedTitle) {
      setError("Course title is required.");
      return;
    }

    if (
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0 ||
      !Number.isInteger(parsedPrice * 100)
    ) {
      setError("Enter a valid non-negative course price.");
      return;
    }

    if (!["beginner", "intermediate", "advanced"].includes(difficulty)) {
      setError("Please select a valid difficulty level.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("title", trimmedTitle);
      formData.append("description", trimmedDescription);
      formData.append("category", trimmedCategory);
      formData.append("difficulty", difficulty);
      formData.append("price", String(parsedPrice));

      if (thumbnail) {
        formData.append("thumbnail", thumbnail);
      }

      const response = await api.post<ApiResponse<CreatedCourse>>(
        "/courses",
        formData,
      );

      if (!response.data?.success) {
        throw new Error(response.data?.message || "Course creation failed.");
      }

      const createdCourse = response.data.data;

      const courseId = createdCourse?.id ?? createdCourse?.course_id;

      if (!courseId) {
        throw new Error(
          "Course creation response did not include a course ID.",
        );
      }

      setSuccess("Course created successfully. Redirecting...");

      navigate(`/instructor/courses/${courseId}/content`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create course."));
    } finally {
      setLoading(false);
    }
  }

  if (!isInstructor) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold">Instructor Access Required</h1>

        <p className="mt-3 text-muted-foreground">
          Only instructors can create courses.
        </p>

        <Link to="/dashboard" className="mt-4 inline-block underline">
          Back to Dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="mb-6 text-sm text-muted-foreground hover:underline"
        >
          ← Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold">Create Course</h1>

        <p className="mt-2 text-muted-foreground">
          Submit a new course for admin approval.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5 rounded-xl border bg-card p-6"
        >
          <div>
            <label htmlFor="title" className="mb-2 block font-medium">
              Course Title *
            </label>

            <input
              id="title"
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Introduction to React"
              className="w-full rounded-lg border bg-background px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="description" className="mb-2 block font-medium">
              Description
            </label>

            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What will students learn?"
              className="w-full rounded-lg border bg-background px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="thumbnail" className="mb-2 block font-medium">
              Course Thumbnail
            </label>

            <input
              id="thumbnail"
              name="thumbnail"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleThumbnailChange}
              className="block w-full"
            />

            <p className="mt-1 text-sm text-muted-foreground">
              JPEG, PNG, or WebP. Maximum size: 5 MB.
            </p>

            {thumbnail && (
              <p className="mt-2 break-all text-sm text-muted-foreground">
                Selected: {thumbnail.name} (
                {(thumbnail.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div>
            <label htmlFor="category" className="mb-2 block font-medium">
              Category
            </label>

            <input
              id="category"
              type="text"
              maxLength={100}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Programming"
              className="w-full rounded-lg border bg-background px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="difficulty" className="mb-2 block font-medium">
              Difficulty
            </label>

            <select
              id="difficulty"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div>
            <label htmlFor="price" className="mb-2 block font-medium">
              Price (INR)
            </label>

            <input
              id="price"
              type="number"
              min="0"
              step="0.01"
              required
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          {success && (
            <p role="status" className="rounded-lg border p-3 text-sm">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Course for Approval"}
          </button>
        </form>
      </div>
    </main>
  );
}
