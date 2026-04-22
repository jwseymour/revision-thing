import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardClientView } from "./DashboardClientView";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const displayName = profile?.display_name || user.email?.split("@")[0] || "Student";

  // Fetch all resources
  const { data: resources } = await supabase
    .from("resources")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return <DashboardClientView displayName={displayName} resources={resources || []} />;
}
