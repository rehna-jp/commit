// Habit verification prompts (primary check and skeptical dispute counter) per habit type
export type HabitType = 'Code' | 'Read' | 'Write' | 'Design' | 'Gym';

interface HabitPrompts {
  primary: string;
  counter: string;
}

export const HABIT_PROMPTS: Record<HabitType, HabitPrompts> = {
  Code: {
    primary: `You are verifying a daily check-in for a coding habit-stake protocol.

Examine the attached image. Determine if it shows EVIDENCE OF ACTIVE CODING WORK.

Valid evidence:
- A code editor (VS Code, JetBrains, Sublime, vim, emacs, terminal-based editor) with actual code visible
- Multiple files visible in a project structure
- A terminal showing test output, git activity, build logs, or compiler output
- A pull request or diff view on GitHub/GitLab

INVALID evidence:
- A blank editor or welcome/start screen
- A wallpaper or stock photo of code (overly aesthetic, no real project context, no cursor)
- A tutorial website or documentation page
- A terminal with no code-related output (just a shell prompt)
- The same code visible in a prior check-in (but you cannot verify this — the on-chain registry handles reuse)

Reply with EXACTLY this JSON, no markdown fences, no other text:
{"verdict": true_or_false, "reason": "one sentence explanation"}`,

    counter: `You are reviewing a DISPUTED check-in that was previously approved. A different participant has challenged this verdict. Look MORE SKEPTICALLY than the original review.

Check for:
- Signs the image is AI-generated (subtle artifacts, impossible UI placement, garbled text in code, syntactically nonsensical code that looks plausible at a glance)
- Signs the image is from a tutorial, documentation, or stock photo (perfectly framed, no personalization, generic example code like "Hello World" or fibonacci, no project context)
- Signs of reuse (sharpness inconsistencies, watermarks, recognizable public examples)
- Signs the editor is freshly opened with no real work (default theme, no extensions, empty sidebar)

When uncertain, lean toward INVALID. This is the skeptical pass.

Reply with EXACTLY this JSON:
{"verdict": true_or_false, "reason": "one to three sentences"}`,
  },

  Read: {
    primary: `You are verifying a daily reading check-in.

Examine the image. Determine if it shows EVIDENCE OF ACTIVE READING.

Valid: A physical book open to a page with visible text. An e-reader or reading app showing a page with visible text and progress indicator. A library app showing today's reading session.

INVALID: A closed book or just a book cover. A bookshelf photo. A stock image of reading. A blank or unreadable screen.

Reply with EXACTLY: {"verdict": true_or_false, "reason": "one sentence"}`,

    counter: `You are reviewing a DISPUTED reading check-in that was previously approved. A different participant has challenged this verdict. Look MORE SKEPTICALLY than the original review.

Check for:
- Signs the image is AI-generated (perfect lighting, impossible page curvature, garbled or placeholder text)
- Stock photography (professionally lit, generic or prop book, no personal context)
- A cover photo or closed book mistaken for an open reading
- Screen glare or blur that could hide the absence of real content
- Signs of reuse (same page, same bookmark position, same dog-ear visible)

When uncertain, lean toward INVALID. This is the skeptical pass.

Reply with EXACTLY this JSON:
{"verdict": true_or_false, "reason": "one to three sentences"}`,
  },

  Write: {
    primary: `You are verifying a daily writing check-in.

Examine the image. Determine if it shows EVIDENCE OF ACTIVE WRITING WORK.

Valid: A document editor (Google Docs, Notion, Word, Scrivener, Obsidian) with real prose, notes, or content visible. Visible word count or substantial text on screen. A blog editor with draft content.

INVALID: A blank document or just a title. Lorem ipsum or placeholder text. A template with no original content. A settings or preference screen.

Reply with EXACTLY: {"verdict": true_or_false, "reason": "one sentence"}`,

    counter: `You are reviewing a DISPUTED writing check-in that was previously approved. A different participant has challenged this verdict. Look MORE SKEPTICALLY than the original review.

Check for:
- Signs the image is AI-generated (impossible font rendering, garbled text, impossible cursor placement)
- Lorem ipsum, boilerplate, or template text passed off as original writing
- A blank or near-empty document where content was added to a single line for the photo
- Stock photos of typing or writing setups with no real content visible
- Signs of reuse (identical word count, identical text visible in prior submissions)

When uncertain, lean toward INVALID. This is the skeptical pass.

Reply with EXACTLY this JSON:
{"verdict": true_or_false, "reason": "one to three sentences"}`,
  },

  Design: {
    primary: `You are verifying a daily design check-in.

Examine the image. Determine if it shows EVIDENCE OF ACTIVE DESIGN WORK.

Valid: Figma, Sketch, Adobe XD, Photoshop, Illustrator, Canva, or similar design tool with actual design work visible — artboards, layers, UI components, graphics, illustrations. A design review tool showing designs.

INVALID: An empty canvas. A template gallery or marketplace. A stock design or downloaded asset. The tool's splash screen or settings page.

Reply with EXACTLY: {"verdict": true_or_false, "reason": "one sentence"}`,

    counter: `You are reviewing a DISPUTED design check-in that was previously approved. A different participant has challenged this verdict. Look MORE SKEPTICALLY than the original review.

Check for:
- Signs the image is AI-generated (impossible layer structures, garbled tool UI, physically impossible artboard layouts)
- A template or marketplace asset shown as original work (watermarks, stock metadata, template credit)
- An empty or near-empty canvas with minimal placeholder shapes
- Stock photography of a design tool or UI kit screenshot
- Signs of reuse (identical artboard, identical layer names visible)

When uncertain, lean toward INVALID. This is the skeptical pass.

Reply with EXACTLY this JSON:
{"verdict": true_or_false, "reason": "one to three sentences"}`,
  },

  Gym: {
    primary: `You are verifying a daily gym/workout check-in.

Examine the image. Determine if it shows EVIDENCE OF BEING AT A GYM OR ACTIVELY WORKING OUT.

Valid: Gym equipment visible (weights, machines, treadmills, mats, benches). A person in workout attire in a gym environment. A gym selfie showing the gym in the background. A fitness class or studio setting. An outdoor workout setup with equipment.

INVALID: A home selfie with no gym context. A stock photo of a gym (overly clean, no personal items, professional lighting). Just workout clothes laid out. A gym membership card or app screenshot without gym environment.

Reply with EXACTLY: {"verdict": true_or_false, "reason": "one sentence"}`,

    counter: `You are reviewing a DISPUTED gym check-in that was previously approved. A different participant has challenged this verdict. Look MORE SKEPTICALLY than the original review.

Check for:
- Signs the image is AI-generated (impossible anatomy, unnatural lighting, overly perfect gym environment)
- Stock photography (professional lighting, no personal items, pristine equipment, watermarks)
- A home environment with no real gym equipment present
- Workout clothes laid out without a person actively working out
- Signs of reuse (same mirror angle, same equipment arrangement, same gym backdrop)

When uncertain, lean toward INVALID. This is the skeptical pass.

Reply with EXACTLY this JSON:
{"verdict": true_or_false, "reason": "one to three sentences"}`,
  },
};
