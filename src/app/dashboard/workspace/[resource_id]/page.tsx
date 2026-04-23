import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { WorkspaceContainer } from "@/components/workspace/WorkspaceContainer";
import styles from "./workspace.module.css";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ resource_id: string }>;
}) {
  const { resource_id } = await params;
  
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch the resource
  const { data: resource, error } = await supabase
    .from("resources")
    .select("*")
    .eq("id", resource_id)
    .single();

  if (error || !resource) {
    return (
      <div className={styles.page}>
        <h1>Resource Not Found</h1>
        <p className="text-muted">The requested document could not be located.</p>
      </div>
    );
  }

  const resourceName = resource.file_name || "Document";

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Breadcrumb
          items={[
            { label: "Library", href: "/dashboard?library=true" },
            { label: resourceName },
          ]}
        />
      </div>

      <div className={styles.workspaceWrapper}>
        <WorkspaceContainer resource={resource} />
      </div>
    </div>
  );
}
