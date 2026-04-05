import { ThemeToggle } from "@/components/ThemeToggle";
import styles from "./auth.module.css";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles["auth-layout"]}>
      <div className={styles["auth-theme-toggle"]}>
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
