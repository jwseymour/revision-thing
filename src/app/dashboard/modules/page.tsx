import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ModuleCard } from "@/components/ModuleCard";
import { EmptyState } from "@/components/EmptyState";
import styles from "./modules.module.css";

interface ModuleData {
  name: string;
  topics: Set<string>;
  flashcardCount: number;
  questionCount: number;
  masterySum: number;
  masteryCount: number;
}

export default async function ModulesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch flashcards grouped by module/topic
  const { data: flashcards } = await supabase
    .from("flashcards")
    .select("module, topic")
    .eq("user_id", user.id);

  // Fetch questions grouped by module/topic
  const { data: questions } = await supabase
    .from("questions")
    .select("module, topic")
    .eq("user_id", user.id);

  // Fetch mastery scores
  const { data: masteryScores } = await supabase
    .from("mastery_scores")
    .select("module, topic, score")
    .eq("user_id", user.id);

  // Aggregate by module
  const moduleMap = new Map<string, ModuleData>();

  const getOrCreate = (name: string): ModuleData => {
    if (!moduleMap.has(name)) {
      moduleMap.set(name, {
        name,
        topics: new Set(),
        flashcardCount: 0,
        questionCount: 0,
        masterySum: 0,
        masteryCount: 0,
      });
    }
    return moduleMap.get(name)!;
  };

  flashcards?.forEach((fc) => {
    const mod = getOrCreate(fc.module);
    mod.topics.add(fc.topic);
    mod.flashcardCount++;
  });

  questions?.forEach((q) => {
    const mod = getOrCreate(q.module);
    mod.topics.add(q.topic);
    mod.questionCount++;
  });

  masteryScores?.forEach((ms) => {
    const mod = getOrCreate(ms.module);
    mod.masterySum += ms.score;
    mod.masteryCount++;
  });

  const modules = Array.from(moduleMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Modules</h1>
        <p className="text-muted">
          {modules.length} module{modules.length !== 1 ? "s" : ""} •{" "}
          Browse your revision content by module
        </p>
      </div>

      {modules.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No modules yet"
          description="Upload lecture slides or notes to create your first module. The AI will generate flashcards and questions automatically."
          actionLabel="Upload PDFs"
          actionHref="/dashboard/upload"
        />
      ) : (
        <div className={styles.grid}>
          {modules.map((mod) => (
            <ModuleCard
              key={mod.name}
              name={mod.name}
              topicCount={mod.topics.size}
              flashcardCount={mod.flashcardCount}
              questionCount={mod.questionCount}
              mastery={
                mod.masteryCount > 0
                  ? Math.round(mod.masterySum / mod.masteryCount)
                  : 0
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
