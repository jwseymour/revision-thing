import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SupervisorClient from "./SupervisorClient";

export default async function SupervisorPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch topics the user has available to practice
  // Can just fetch from mastery_scores since they exist once content is generated
  const { data: topicsData } = await supabase
    .from("mastery_scores")
    .select("module, topic")
    .eq("user_id", user.id);

  const availableTopics = topicsData || [];

  return <SupervisorClient availableTopics={availableTopics} />;
}
