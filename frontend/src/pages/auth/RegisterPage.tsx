import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import api from "@/services/api";

interface RegisterResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    full_name: string;
    email: string;
    created_at: string;
  };
}

export default function RegisterPage() {
  const navigate = useNavigate();

  const [role, setRole] = useState<"student" | "instructor">("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setIsError(false);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setIsError(true);
      setMessage("Please enter your full name.");
      return;
    }

    if (password.length < 8) {
      setIsError(true);
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post<RegisterResponse>("/auth/register", {
        name: trimmedName,
        email: trimmedEmail,
        password,
        role,
      });

      const result = response.data;

      if (!result.success) {
        throw new Error(result.message || "Registration failed.");
      }

      navigate("/login", {
        replace: true,
        state: {
          registrationSuccess: true,
          email: trimmedEmail,
        },
      });
    } catch (error: unknown) {
      let errorMessage = "Unable to create your account. Please try again.";

      if (typeof error === "object" && error !== null && "response" in error) {
        const responseError = error.response;

        if (
          typeof responseError === "object" &&
          responseError !== null &&
          "data" in responseError
        ) {
          const data = responseError.data;

          if (
            typeof data === "object" &&
            data !== null &&
            "message" in data &&
            typeof data.message === "string"
          ) {
            errorMessage = data.message;
          }
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setIsError(true);
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Create your account</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Join LMS-AI and start learning.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Full name
            </label>

            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />

            <p className="text-xs text-muted-foreground">
              Use at least 8 characters.
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">I want to join as</legend>

            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 ${
                  role === "student" ? "border-primary bg-primary/5" : ""
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="student"
                  checked={role === "student"}
                  onChange={() => setRole("student")}
                />

                <span className="text-sm">Student</span>
              </label>

              <label
                className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 ${
                  role === "instructor" ? "border-primary bg-primary/5" : ""
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="instructor"
                  checked={role === "instructor"}
                  onChange={() => setRole("instructor")}
                />

                <span className="text-sm">Instructor</span>
              </label>
            </div>
          </fieldset>

          {message && (
            <p
              role={isError ? "alert" : "status"}
              aria-live="polite"
              className={`text-sm ${
                isError ? "text-destructive" : "text-green-600"
              }`}
            >
              {message}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="underline">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
