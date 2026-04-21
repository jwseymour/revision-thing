"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "../actions";
import styles from "../auth.module.css";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);

    try {
      const result = await signIn(formData);
      if (result?.error) {
        setError(result.error);
      }
    } catch (e: any) {
      // Next.js redirect() throws a special error — let it propagate
      if (e?.digest?.startsWith("NEXT_REDIRECT")) {
        throw e;
      }
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles["auth-card"]}>
      <div className={styles["auth-header"]}>
        <div className={styles["auth-logo"]}>tripos</div>
        <p>Sign in to continue your revision</p>
      </div>

      {error && <div className={styles["auth-error"]}>{error}</div>}

      <form action={handleSubmit} className={styles["auth-form"]}>
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@cam.ac.uk"
            className="input"
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            className="input"
            required
            autoComplete="current-password"
            minLength={6}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner" /> Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <div className={styles["auth-footer"]}>
        Don&apos;t have an account?{" "}
        <Link href="/signup">Create one</Link>
      </div>
    </div>
  );
}
