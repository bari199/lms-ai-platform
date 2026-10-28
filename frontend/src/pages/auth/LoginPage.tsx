import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import api from "@/services/api";
import { useDispatch } from "react-redux";
import { setAccessToken } from "@/services/tokenStorage";
import type { AppDispatch } from "@/store";
import { setUser } from "@/store/authSlice";

interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      full_name: string;
      email: string;
      roles: string[];
    };
    accessToken: string;
  };
}

interface RegistrationState {
  registrationSuccess?: boolean;
  email?: string;
}

export default function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();

  const registrationState = location.state as RegistrationState | null;

  const [email, setEmail] = useState(registrationState?.email ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setIsError(false);
    setLoading(true);

    try {
      const response = await api.post<LoginResponse>("/auth/login", {
        email: email.trim(),
        password,
      });

      const result = response.data;

      if (!result.success || !result.data) {
        setIsError(true);
        setMessage(result.message || "Login failed.");
        return;
      }

      const { user, accessToken } = result.data;

      // Keep the access token in memory.
      setAccessToken(accessToken);

      // Save the authenticated user in Redux.
      dispatch(setUser(user));

      // Navigate to the dashboard.
      navigate("/dashboard", { replace: true });
    } catch (error: unknown) {
      setIsError(true);

      let apiMessage = "Unable to log in. Please try again.";

      if (typeof error === "object" && error !== null && "response" in error) {
        const errorResponse = error.response;

        if (
          typeof errorResponse === "object" &&
          errorResponse !== null &&
          "data" in errorResponse
        ) {
          const errorData = errorResponse.data;

          if (
            typeof errorData === "object" &&
            errorData !== null &&
            "message" in errorData &&
            typeof errorData.message === "string"
          ) {
            apiMessage = errorData.message;
          }
        }
      }

      setMessage(apiMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Welcome back</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to continue learning.
        </p>

        {registrationState?.registrationSuccess && (
          <p
            role="status"
            aria-live="polite"
            className="mt-4 rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm text-green-700"
          >
            Account created successfully. Please sign in.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

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
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-5 text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="underline">
            Sign up
          </Link>
        </p>

        <p className="mt-3 text-sm text-muted-foreground">
          Browse courses instead?{" "}
          <Link to="/courses" className="underline">
            View courses
          </Link>
        </p>
      </section>
    </main>
  );
}
