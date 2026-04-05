export default function PracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Practice mode uses full-screen focus — no sidebar or dashboard chrome
  return <>{children}</>;
}
