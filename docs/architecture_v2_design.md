# System Architecture V2: Active Reading & Contextual Intelligence

## 1. Paradigm Shift
The platform is transitioning from a passive "bulk auto-generation" model to a highly contextual **Active Reading** workflow. 

Instead of extracting all text blindly from a PDF and generating an unsorted list of flashcards, users will load the PDF into an interactive reader. As they study the material organically, they can highlight specific sentences or equations to dynamically spawn anchored flashcards and annotations. The system will track mastery at the specific source location of the material, painting a visual "heat map" directly onto the lecture slides/notes as they read.

Additionally, the system will support a dedicated **Past Paper** workflow, offering split-screen answering capabilities combined with targeted AI Supervisor feedback contextualised by the specific exam questions being attempted.

---

## 2. Updated Data Architecture (Supabase Schema)

To support spatial anchoring, multi-type flashcards, and past papers, the schema requires fundamental additions:

### 2.1 Enums & Types
```sql
CREATE TYPE resource_type AS ENUM ('notes', 'past_paper');
CREATE TYPE flashcard_type AS ENUM ('statement', 'qna', 'deep_dive');
```

### 2.2 Table Alterations
**Resources Table**
```sql
ALTER TABLE resources ADD COLUMN type resource_type DEFAULT 'notes';
```

**Flashcards Table**
```sql
ALTER TABLE flashcards ADD COLUMN card_type flashcard_type DEFAULT 'qna';
ALTER TABLE flashcards ADD COLUMN source_rects JSONB; 
ALTER TABLE flashcards ADD COLUMN cascade_content JSONB; -- Used exclusively for 'deep_dive' types
```
*Note: `source_rects` will hold coordinates bounding the highlighted text so the client can draw overlays: e.g., `[{ page: 1, x: 10, y: 20, width: 100, height: 15 }]`.*

**Annotations Table (NEW)**
```sql
CREATE TABLE annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source_rects JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Past Paper Answers (NEW)**
```sql
CREATE TABLE past_paper_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, resource_id)
);
```

---

## 3. Client Architecture: The Interactive Document Reader

The core UI addition is the `/dashboard/reader/[resource_id]` view. It consists of layers:

1. **Base Layer (PDF Rendering):** Uses `react-pdf` to render the canvas of the PDF page. 
2. **Text Layer:** An invisible overlay aligned exactly with the canvas that allows the native browser text selection system to fire `Selection` API events.
3. **Execution Layer (The Toolbar):** A custom hook listens to `document.getSelection()`. When text is highlighted on the text layer, it computes the bounding box, maps it to PDF document coordinates, and renders a floating Context Menu: `[Create Flashcard] | [Add Comment]`.
4. **Overlay Layer (Mastery UI):** Queries all flashcards and annotations belonging to the `resource_id`. Iterates through their `source_rects` and draws translucent colored `<div>` boxes over those exact positions. The color of the flashcard bounding box is derived from its SM-2 `interval_days` (Red = Fragile (<3 days), Yellow = Learning (4-15), Green = Exam Ready (>21 days)).

---

## 4. Flashcard Types & The "Cascade" Engine

Flashcards generated via the active reader can take three forms, which dictates how the `/practice` engine renders them:

1. **Statement (Cloze):** A single string where a key term is hidden.
2. **Q&A:** Standard Front / Back flip card.
3. **Deep Dive (Cascade):** Used for complex algorithms or multi-step proofs. 
   - **Data Structure:** `cascade_content` holds a JSON array: `["Step 1", "Step 2", "Step 3"]`.
   - **UX:** The user sees "Step 1". Below it is a "Reveal Next Step" button. They mentally simulate the next step, click reveal, verify their thought process, and repeat passing through the entire algorithm flow before assigning a final `Classification` (Confident / Guessed / Incorrect) to the overall attempt.

---

## 5. Past Paper Workflow & Supervisor Integration

**The Layout:**
When a user opens a resource where `type === 'past_paper'`, the UI renders a split-screen view:
- **Left Panel:** The PDF Reader (Locked out of annotation mode, read-only).
- **Right Panel:** A rich text editor bound to the `past_paper_answers` table.

**The Supervisor Tie-In:**
A floating AI action button exists on the text editor. When pressed, the user can invoke the AI Supervisor. 
- **The Prompt Payload** sent to `/api/supervisor` will include:
  1. The raw text of the entire past paper (extracted server side using `pdf-parse`).
  2. The user's typed out `past_paper_answers`.
  3. The specific message query from the user (e.g. "Is my approach to Q3 correct?").
- The Supervisor, inherently Socratic, evaluates the answer against the paper context but challenges the user rather than rewriting the answer for them.
