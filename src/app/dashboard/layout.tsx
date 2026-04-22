import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "./sidebar";
import styles from "./dashboard.module.css";
import { ModuleProvider } from "./ModuleContext";
import { GlobalShortcuts } from "@/components/GlobalShortcuts";
import { ShortcutsModal } from "@/components/ShortcutsModal";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const displayName = profile?.display_name || user.email?.split("@")[0] || "User";
  const email = user.email || "";

  return (
    <div className={styles["dashboard-layout"]}>
      <GlobalShortcuts />
      <ShortcutsModal />
      <ModuleProvider>
        <Sidebar userName={displayName} userEmail={email} />
        <main className={styles["main-content"]}>
          {children}
        </main>
      </ModuleProvider>
    </div>
  );
}
