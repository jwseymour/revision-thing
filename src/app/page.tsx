import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import styles from "./page.module.css";

export default function LandingPage() {
  return (
    <div className={styles.landing}>
      {/* Navigation */}
      <nav className={styles["landing-nav"]}>
        <div className={styles["landing-logo"]}>tripos</div>
        <div className={styles["landing-nav-links"]}>
          <ThemeToggle />
          <Link href="/login" className="btn btn-ghost">
            Log In
          </Link>
          <Link href="/signup" className="btn btn-primary">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles["hero-content"]}>
          <div className={styles["hero-badge"]}>
            Built for Cambridge CS
          </div>
          <h1>
            Transform revision into{" "}
            <span className="accent-text">exam-ready mastery</span>
          </h1>
          <p className={styles["hero-subtitle"]}>
            A performance optimisation system that turns incomplete understanding
            into fast, reliable competence through active recall, spaced
            repetition, and deliberate practice.
          </p>
          <div className={styles["hero-cta"]}>
            <Link href="/signup" className="btn btn-primary btn-lg">
              Start Revising
            </Link>
            <Link href="/login" className="btn btn-secondary btn-lg">
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <div className={styles["features-header"]}>
          <h2>Engineered for <span className="accent-text">performance</span></h2>
          <p className="text-muted">
            Every feature exists to maximise your exam score. Nothing more.
          </p>
        </div>
        <div className={styles["features-grid"]}>
          <div className={styles["feature-card"]}>
            <div className={styles["feature-icon"]}>⚡</div>
            <h3>Active Recall</h3>
            <p>
              Every interaction forces retrieval. Upload slides, and the system
              generates questions that test understanding, not recognition.
            </p>
          </div>
          <div className={styles["feature-card"]}>
            <div className={styles["feature-icon"]}>🔄</div>
            <h3>Spaced Repetition</h3>
            <p>
              SM-2 scheduling ensures you review material at optimal intervals.
              Modules resurface just before you forget them.
            </p>
          </div>
          <div className={styles["feature-card"]}>
            <div className={styles["feature-icon"]}>📊</div>
            <h3>Mastery Tracking</h3>
            <p>
              Probabilistic mastery scores for every module. See exactly where
              you are strong, fragile, and where blind spots hide.
            </p>
          </div>
          <div className={styles["feature-card"]}>
            <div className={styles["feature-icon"]}>📄</div>
            <h3>PDF to Questions</h3>
            <p>
              Upload lecture slides and notes. AI extracts key concepts and
              generates exam-style questions and flashcards automatically.
            </p>
          </div>
          <div className={styles["feature-card"]}>
            <div className={styles["feature-icon"]}>🔍</div>
            <h3>Mistake Analysis</h3>
            <p>
              Every error is captured and classified. The system identifies
              recurring weaknesses and generates targeted review sessions.
            </p>
          </div>
          <div className={styles["feature-card"]}>
            <div className={styles["feature-icon"]}>🎓</div>
            <h3>AI Supervisor</h3>
            <p>
              Socratic questioning powered by your course material. The AI
              challenges weak explanations — like a real supervision.
            </p>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className={styles.philosophy}>
        <blockquote>
          &ldquo;Discomfort is the signal of learning.&rdquo;
        </blockquote>
        <p className="text-muted">
          This system is not designed to feel easy. It is designed to be
          efficient, accurate, and slightly uncomfortable — because that
          is how genuine competence is built.
        </p>
      </section>

      {/* Footer */}
      <footer className={styles["landing-footer"]}>
        <p>tripos — built for cambridge cs</p>
      </footer>
    </div>
  );
}
