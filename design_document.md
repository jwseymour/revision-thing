# Cambridge CS Revision System — Design Document

This document serves as the foundational blueprint for a complete rebuild of the Cambridge CS Revision System. It is exclusively focused on requirements, user experience, feature capabilities, and scientific learning integration, devoid of specific low-level implementation details (outside of the chosen tech stack).

## 1. System Overview & Objectives
**Goal**: Create a highly tailored, deeply integrated active learning platform to prepare the user exclusively for Cambridge University Computer Science undergraduate exams.
**Target Audience**: A single power user (you). All interfaces, interactions, and tracking mechanics are optimized specifically for your personal workflow and maximizing your long-term retention.

### Core Philosophy
- **Zero Friction**: The UI must get out of the way, offering high-density information without overwhelming the user. Margins and padding are minimized.
- **Deep Tracking**: Every interaction (flashcard reviews, Socratic dialogue performance, reading progress) feeds into a holistic mastery model.
- **AI-Native**: Artificial Intelligence is not a bolt-on feature; it is deeply embedded into the reading, generation, and testing loops.

---

## 2. Information Architecture
The syllabus is rigidly structured to mirror the Cambridge Tripos:
* **Year** (Part IA, Part IB, Part II)
  * **Paper** (e.g., Paper 1, Paper 2)
    * **Module** (e.g., Foundations of Computer Science, Object-Oriented Programming)

All resources, notes, flashcards, and AI states are scoped primarily to the **Module** level.

---

## 3. Technology & Storage Architecture
* **Frontend**: Next.js, hosted on Vercel.
* **Backend State & Tracking**: Supabase (PostgreSQL), storing all mutable user data (progress, flashcards, user notes, AI threads, performance history).
* **Resource Storage**: The Local Filesystem.
  * *Why*: Modules, PDFs, and Markdown notes are immutable for the standard user. They are only ingested, updated, or created when the user runs the app locally as an "Admin" on `localhost`. When deployed to Vercel, the app treats these resources as read-only.
* **AI Engine**: A system capable of holding long-lived Assistant threads (mirroring the OpenAI Assistants API). Must support file attachment (contextualizing on module slides/notes), strict structured output (JSON for flashcard generation), and function calling/system prompting.

---

## 4. Primary Entities
1. **Modules**: The central hub. Links together resources, flashcards, and Socratic sessions.
2. **Resources (PDF / Markdown)**: Rendered immutably. Used as the anchor for annotations and AI context.
3. **Flashcards**: State-tracked items tied to specific notes/resources.
   * *Types*:
     * **Statement**: Simple front/back definition.
     * **Q&A**: Interrogative prompt requiring a specific answer.
     * **Multi-Sided (Deep-Dive)**: Specialized cards for algorithms/complex systems. Flipping the card reveals sequential steps or deepening layers of the concept, rather than just one answer.
4. **Past Papers**: Exam papers processed into localized interactions, allowing the user to attempt them and immediately review them with the Supervisor.
5. **AI Supervisor**: A persistent, Socratic AI tutor tied to the user's progress.

---

## 5. UI/UX Interface Design

### Visual Identity
* **Aesthetic**: Warm, comfortable, and intellectual. Uses Geist fonts (sans and mono).
* **Palette**: Dark Mode default (`#16140f` backgrounds) with warm amber/gold accents (`#e5a84b`). Followed exactly from the original project.
* **Mastery Colors**: Unseen (Gray) → Fragile (Red `#d97a7a`) → Developing (Amber `#e5a84b`) → Solid (Blue `#7aaed4`) → Exam Ready (Green `#7bc47f`).

### Layout Structure
The primary interface relies on a three-section **Sidebar** alongside a **Main Content Area**.

**1. Sidebar (Navigation & Global State)**
* **Top (Global/Progress):** Module-independent analytics. Streaks, overall Tripos syllabus progress, daily review queues, and top-level guidance on what requires attention.
* **Middle (Context Switcher):** The Module Selector. Operates as a folder hierarchy (Year → Paper → Module). To save space, it collapses entirely, showing *only* the current active path or module name unless the user is actively changing context.
* **Bottom (Module Features):** Context-dependent navigation. Once a module is active, this section provides links to: Notes, Flashcards, Past Papers, and the dedicated AI Supervisor view for that module.

**2. Main Area & AI Panel**
* **Dynamic Split-View**: When viewing Notes, Flashcards, or Past Papers, the user can toggle a resizable AI Supervisor panel on the side.
* **Density**: Padding is actively minimized. The focus is on putting as much readable text and interactivity on the screen as comfortably possible.

---

## 6. Key User Workflows

### Phase 1: Ingestion & Active Reading
1. Admin (Localhost) uploads a PDF/MD of pre-made notes to the filesystem.
2. The User opens the Notes view.
3. The User reads, highlighting passages and adding personal (Supabase-stored) annotations.
4. **AI Generation Checkpoint**: The user highlights a complex section and hits 'Generate Flashcard'. The AI reviews the text and creates optimal flashcards (Statement, Q&A, or Multi-sided). The cards are directly linked to that specific highlighted text.
5. **Progress Visualization**: As flashcards are generated and later mastered, the Notes view displays a colored overlay (e.g., a margin bar) next to the corresponding text, visually indicating how well the user understands that specific section of the document.

### Phase 2: Interstitial Socratic Supervision
1. While reading, something doesn't make sense.
2. The user toggles the AI Supervisor panel. Because it is tied to the Module, the AI already knows what document is open.
3. The user asks for a clarification (via text or **speech-to-text**).
4. The AI responds Socratically, prompting the user rather than just giving the answer, ensuring active engagement.

### Phase 3: Review & Scientific Tracking
1. The app compiles daily reviews based on advanced spaced repetition algorithms (e.g., FSRS - Free Spaced Repetition Scheduler, highly superior to SM-2).
2. The user reviews flashcards. The mastery state updates.
3. The global tracking system aggregates flashcard retention, Socratic session performance, and reading completeness to assign a holistic "Mastery Score" to the module.

### Phase 4: Past Papers & Synthesis
1. Post-review, the user transitions to the Past Papers interface.
2. User attempts questions.
3. Upon completion, the user feeds their answers to the AI Supervisor. The Supervisor grades the attempt, identifies knowledge gaps, and can instantly queue weak concepts back into the spaced repetition algorithm or generate new remedial flashcards.

---

## 7. AI Supervisor Rules of Engagement
* **Socratic Method**: It must prioritize asking leading questions over direct instruction.
* **Contextual Awareness**: It knows the user's progress. If the user struggles with a concept they *should* have mastered based on their flashcard stats, adjusting its tutorial approach.
* **Speech Enabled**: The interface must support seamless audio input and ideally audio output for conversational studying.
* **Tool Access**: It has the ability to spawn flashcards, flag topics as "fragile", or look up specific sections within the Localhost resource folder.
