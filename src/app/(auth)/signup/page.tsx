"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "../actions";
import styles from "../auth.module.css";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);

    try {
      const result = await signUp(formData);
      if (result?.error) {
        setError(result.error);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles["auth-card"]}>
      <div className={styles["auth-header"]}>
        <div className={styles["auth-logo"]}>tripos</div>
        <p>Create your account to start revising</p>
      </div>

      {error && <div className={styles["auth-error"]}>{error}</div>}

      <form action={handleSubmit} className={styles["auth-form"]}>
        <div className="form-group">
          <label htmlFor="displayName" className="form-label">
            Display Name
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            placeholder="Your name"
            className="input"
            autoComplete="name"
          />
        </div>

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
            placeholder="At least 6 characters"
            className="input"
            required
            autoComplete="new-password"
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
              <span className="spinner" /> Creating account...
            </>
          ) : (
            "Create Account"
          )}
        </button>
      </form>

      <div className={styles["auth-footer"]}>
        Already have an account?{" "}
        <Link href="/login">Sign in</Link>
      </div>
    </div>
  );
}
