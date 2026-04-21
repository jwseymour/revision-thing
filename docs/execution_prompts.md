# Execution Prompts for V2 Active Reading Shift

Below is a sequenced series of prompts designed to be executed one at a time in fresh context windows. This approach strictly manages context, optimises token efficiency, and ensures robust, focused implementations of the enormous architectural shift to an active-reading methodology.

---

### Phase 1: Context Preparation & Database Shift

**Goal:** Modify the underlying data layer to structure the active annotation and past-paper workflows.

**The Prompt:**
> "I am shifting my 'revision-thing' Next.js application from an auto-generation model to a contextual 'Active Reading' model. I need to implement sweeping changes to `supabase/schema.sql` to support this logic.
> 
> **Instructions:**
> 1. Read `supabase/schema.sql`.
> 2. Create an ENUM `resource_type` ('notes', 'past_paper') and an ENUM `flashcard_type` ('statement', 'qna', 'deep_dive').
> 3. Update the `resources` table to add a `type` column using the `resource_type` ENUM defaulting to 'notes'.
> 4. Modify the `flashcards` table: add `card_type` using the `flashcard_type` ENUM defaulting to 'qna'. Add `source_rects` (JSONB) to hold an array of bounding box logic, and `cascade_content` (JSONB) to hold arrays of sequential strings for deep-dive cards.
> 5. Create an `annotations` table (id, user_id, resource_id, content TEXT, source_rects JSONB, created_at) with RLS logic identical to flashcards.
> 6. Create a `past_paper_answers` table (id, user_id, resource_id, answer_text TEXT, status TEXT default 'in_progress', created_at, updated_at). Add RLS matching standard user policies. Ensure `UNIQUE(user_id, resource_id)`.
> 7. Do not touch any Next.js files yet. Output exactly the modified blocks of the `schema.sql`."

---

### Phase 2: Building the PDF Rendering Engine

**Goal:** Provide the core viewer for the module content, allowing native text rendering required for user highlighting.

**The Prompt:**
> "I am building a contextual reading platform. I need to add a PDF reader to my dashboard capable of tracking DOM text selections and overlaying highlights.
> 
> **Instructions:**
> 1. Run the terminal command to `npm install react-pdf @types/react-pdf`. (Ensure you use `next` compatible versions; the project leverages Next 15 / React 19).
> 2. Create a new layout and page route: `/src/app/dashboard/reader/[resource_id]/page.tsx`.
> 3. Use `createClient()` inside `page.tsx` to fetch the `resource` data (including `file_path`) and serve it.
> 4. Create a client component `PDFViewer` in `src/components/pdf/PDFViewer.tsx`. This component must initialize `pdfjs.GlobalWorkerOptions.workerSrc` correctly for Next.js, and use `<Document>` and `<Page>` from `react-pdf` to render the file retrieved from `file_path` statically.
> 5. Expose the `TextLayer` of the PDF. Do NOT implement any highlight floating logic yet; just ensure the absolute path of the PDF is correctly loading in the viewer and the text is natively selectable."

---

### Phase 3: Selection Interception & Generating Anchor Cards

**Goal:** Bind browser selection to contextual flashcard creation and DB inserts.

**The Prompt:**
> "I need to implement text selection interception to spawn contextual flashcards anchored over the PDF. I have a `PDFViewer` component rendering via `react-pdf`.
> 
> **Instructions:**
> 1. In `src/components/pdf/`, create a hook `useTextSelection.ts` that listens to `document.addEventListener("selectionchange")`. Extract the selected text and, crucially, map the DOM bounding rectangles (`range.getBoundingClientRect()`) back to normalized coordinates relative to the underlying PDF page container.
> 2. Create `FloatingToolbar.tsx` that Absolute-positions itself near the selection coordinates when text is highlighted. Include two buttons: 'Create Comment' and 'Create Flashcard'.
> 3. When 'Create Flashcard' is fired, open a `FlashcardModal.tsx` asking the user to choose their type (`statement`, `qna`, `deep_dive`). 
> 4. Create a new API route `/src/app/api/content/generate-from-highlight/route.ts`. This takes the selected text (and a type) and uses the OpenAI SDK to generate the card format correctly. Return it to the client.
> 5. On confirmation, insert a row matching the new `flashcards` table schema, passing in the generated `front`/`back`/`cascade_content` and injecting the normalized `source_rects`. Hook all of this up in the `PDFViewer`."

---

### Phase 4: Mastery Overlays & Cascade Rendering

**Goal:** Modify the viewing layer and the practice UX to handle the new card structure.

**The Prompt:**
> "My system now successfully generates localized flashcards. I need to render 'Mastery Colors' over the PDF and modify my practice UI to support new card types.
> 
> **Instructions:**
> 1. In `PDFViewer.tsx`, fetch all `flashcards` that match the `resource_id`. Loop over their `source_rects`. Draw coloured `<div>` overlays with `position: absolute` directly on top of the PDF. 
> 2. The color should be derived from fetching the SM-2 status for that specific card. (You'll need to join or fetch from the `scheduling_state` or `attempts` depending on how my logic is set up, approximate it to Red/Yellow/Green based on interval logic).
> 3. Update my `/src/app/dashboard/practice/[module]/page.tsx` workflow. When the system dequeues a flashcard of type `deep_dive`, modify the view so instead of simply flipping front/back, it iterates through the `cascade_content` JSON array sequentially. Add a 'Reveal Next Step' button. Only allow classification grading once the array is exhausted."

---

### Phase 5: The Past Paper Socratic Simulator

**Goal:** Build the robust, split-view Past Paper exam simulator.

**The Prompt:**
> "I am implementing a dedicated past-paper workflow in my application where users answer questions side-by-side with an exam paper and talk to an AI supervisor.
> 
> **Instructions:**
> 1. Update the `upload/page.tsx` form. Include a toggle for 'Resource Type' ('notes' vs 'past_paper') and insert this value.
> 2. Create `src/app/dashboard/paper/[resource_id]/page.tsx`. This UI should be a flex row. Left pane: `PDFViewer` (locked to read-only, no highlight logic). Right pane: A rich `textarea` bound via API calls to update the `answer_text` column in the `past_paper_answers` table.
> 3. Implement an 'Ask Supervisor' button below the text area. 
> 4. Modify `/src/app/api/supervisor/route.ts`. When triggered from this context, pull the raw extracted PDF text using `pdf-parse`, and append the user's `answer_text` to the Supervisor's system prompt. Instruct the AI to act as a Socratic tutor evaluating the past paper attempt, guiding the user rather than giving flat answers."
