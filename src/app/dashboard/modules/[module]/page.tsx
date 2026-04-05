import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { TopicRow } from "@/components/TopicRow";
import { MasteryBar } from "@/components/MasteryBar";
import { EmptyState } from "@/components/EmptyState";
import styles from "./module-detail.module.css";

interface TopicData {
  name: string;
  flashcardCount: number;
  questionCount: number;
  mastery: number;
  lastPracticed: string | null;
}

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module: moduleParam } = await params;
  const moduleName = decodeURIComponent(moduleParam);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch flashcards for this module
  const { data: flashcards } = await supabase
    .from("flashcards")
    .select("topic, created_at")
    .eq("user_id", user.id)
    .eq("module", moduleName);

  // Fetch questions for this module
  const { data: questions } = await supabase
    .from("questions")
    .select("topic, created_at")
    .eq("user_id", user.id)
    .eq("module", moduleName);

  // Fetch mastery scores for this module
  const { data: masteryScores } = await supabase
    .from("mastery_scores")
    .select("topic, score, updated_at")
    .eq("user_id", user.id)
    .eq("module", moduleName);

  // Fetch latest attempts for "last practiced"
  const { data: attempts } = await supabase
    .from("attempts")
    .select("topic, created_at")
    .eq("user_id", user.id)
    .eq("module", moduleName)
    .order("created_at", { ascending: false });

  // Aggregate by topic
  const topicMap = new Map<string, TopicData>();

  const getOrCreate = (name: string): TopicData => {
    if (!topicMap.has(name)) {
      topicMap.set(name, {
        name,
        flashcardCount: 0,
        questionCount: 0,
        mastery: 0,
        lastPracticed: null,
      });
    }
    return topicMap.get(name)!;
  };

  flashcards?.forEach((fc) => {
    getOrCreate(fc.topic).flashcardCount++;
  });

  questions?.forEach((q) => {
    getOrCreate(q.topic).questionCount++;
  });

  masteryScores?.forEach((ms) => {
    const topic = getOrCreate(ms.topic);
    topic.mastery = ms.score;
  });

  // Get most recent attempt per topic
  const lastPracticedMap = new Map<string, string>();
  attempts?.forEach((a) => {
    if (!lastPracticedMap.has(a.topic)) {
      lastPracticedMap.set(a.topic, a.created_at);
    }
  });
  lastPracticedMap.forEach((date, topic) => {
    const t = topicMap.get(topic);
    if (t) t.lastPracticed = date;
  });

  const topics = Array.from(topicMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Module-level mastery (weighted by content count)
  const totalItems = topics.reduce(
    (sum, t) => sum + t.flashcardCount + t.questionCount,
    0
  );
  const moduleMastery =
    totalItems > 0
      ? Math.round(
          topics.reduce(
            (sum, t) =>
              sum + t.mastery * (t.flashcardCount + t.questionCount),
            0
          ) / totalItems
        )
      : 0;

  const totalFlashcards = topics.reduce((s, t) => s + t.flashcardCount, 0);
  const totalQuestions = topics.reduce((s, t) => s + t.questionCount, 0);

  return (
    <div className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Modules", href: "/dashboard/modules" },
          { label: moduleName },
        ]}
      />

      <div className={styles.header}>
        <div>
          <h1>{moduleName}</h1>
          <p className="text-muted mono">
            {topics.length} topic{topics.length !== 1 ? "s" : ""} •{" "}
            {totalFlashcards} flashcards • {totalQuestions} questions
          </p>
        </div>
      </div>

      {/* Module Mastery Summary */}
      <div className={styles.masterySummary}>
        <div className={styles.masteryLabel}>Module Mastery</div>
        <MasteryBar value={moduleMastery} size="lg" />
      </div>

      {/* Topics */}
      {topics.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No topics in this module"
          description="Upload PDFs for this module and generate content to see topics here."
          actionLabel="Upload PDFs"
          actionHref="/dashboard/upload"
        />
      ) : (
        <div className={styles.topicList}>
          <h2>Topics</h2>
          <div className={styles.topics}>
            {topics.map((topic) => (
              <TopicRow
                key={topic.name}
                moduleName={moduleName}
                topicName={topic.name}
                flashcardCount={topic.flashcardCount}
                questionCount={topic.questionCount}
                mastery={topic.mastery}
                lastPracticed={topic.lastPracticed}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
