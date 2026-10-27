# Plan Indonesia — Design System

A brand design system for **Yayasan Plan International Indonesia (Plan Indonesia)**, derived from the *Global Brand Manual — Plan Indonesia* and the *InnovAItion Challenge* kick-off deck.

Plan Indonesia is the Indonesian foundation of Plan International, a global child-rights and girls'-equality organisation. It has worked in Indonesia since 1969 and became a national foundation in 2017, running programs in child protection & development, adolescent health & agency, youth employment & entrepreneurship, and disaster preparedness & humanitarian response across 7 provinces. The brand's global proposition is **"Determined Optimists"** and its Indonesian strapline is **"Sampai semua setara"** (Until we are all equal).

## Sources given
- `uploads/Brand Guideline_Plan Indonesia.pdf` — the 56-page Global Brand Manual (Indonesia edition): brand strategy, editorial principles, logo rules, typography, color, graphics (highlights, doodles, icons), photography guidance, and communication SOPs. This is the authoritative source for all foundations here.
- `uploads/Kick Off Meeting InnovAItion Challenge.pdf` — a 9-page campaign kick-off deck used as reference for the sample slides and UI kit.

No codebase, Figma file, logo files, or font binaries were provided. Where a logo would appear, this system renders the brand name in Poppins Bold (see Caveats).

---

## CONTENT FUNDAMENTALS

**Language.** Primary language is **Bahasa Indonesia**. Copy is warm, purposeful, and hopeful — matching the brand attributes *Optimis, Bertekad, Inspiratif, Muda* (Optimistic, Determined, Inspiring, Young).

**Voice — "we / kami".** The organisation speaks in the first-person plural: *"Kami berjuang untuk dunia yang adil…"*, *"Kami tidak akan berhenti sampai semua setara."* It addresses youth audiences directly and informally ("kamu") in campaign contexts, but stays formal ("kami/Anda") in reports and policy work.

**Casing.** Sentence case for body and most headlines. The strapline is set lowercase ("Sampai semua setara"). No ALL-CAPS shouting; emphasis comes from the highlight device and bold weight, not capitalisation.

**Editorial principles (key ingredients).** Prioritise human stories; authentic real-world impact; youth-focused storytelling; locally produced content; collective ability to make change; feminist-leadership and anti-racism principles; inclusive purpose.

**Tone examples.**
- Proposition: *"Determined Optimists percaya bahwa setiap orang berhak mendapatkan kesempatan yang adil."*
- Campaign: *"Kaum Muda Siap Berkarier dengan AI Generatif."*
- Boilerplate (formal): *"Plan Indonesia mengimplementasikan aktivitasnya melalui empat program…"*

**Emoji.** Not used. Youthful energy comes from doodles and highlights, not emoji. Photo credits always read *"Foto: Yayasan Plan International Indonesia / [Fotografer]"*.

**Safeguarding (critical for any content with children).** No full names, addresses, school names, or geotags. Dignified representation only — never crying, frightened, undressed, or shot from above. Consent required. These rules govern all photography and story content.

---

## VISUAL FOUNDATIONS

**Color.** Primary is **Plan Blue `#0072CE`**. Secondary: Light Blue `#58CAE7`, Orange `#ED632F`, Yellow `#FFD500`, Purple `#9900FF`. Alternative/accent (emphasis only): Magenta `#DC0080`, Dark Blue `#243C4B`, Green `#8AC208`, Red `#D40D15`. Neutrals: Black, White, Light Grey `#D9D9D6`. **Rule: max three colors per design.** Formal comms use quieter combinations; campaign/social use bolder ones; accent colors highlight important content. Contrast is tested to WCAG AA (AAA for the approved text pairs).

**Type.** Headlines/intro/sub-heads/quotes/stats → **Poppins Bold**. Body/paragraph-headings/highlights/CTAs → **Arial** (Regular & Bold). Captions/photo-credits/alt-quotes → **Georgia** (italic). No other fonts. Body text ≥ 9pt. Headlines run tight-leading with slight negative tracking.

**Backgrounds.** Solid color fields (Dark Blue or Plan Blue for hero panels), clean white for reports/forms, and full-bleed editorial photography. No gradients on brand graphics; no textures or patterns behind doodles/icons. (This system uses a soft gradient only inside labelled *photo placeholders*, to stand in for real imagery.)

**The signature graphic devices.**
- **Highlights** — a solid rectangular color block behind up to three consecutive Poppins Bold words, high-contrast (e.g. blue block + white text, yellow block + dark-blue text). The core emphasis device.
- **Doodles** — hand-drawn single-color strokes (lines, arrows, scribbles, circles), 4–7px with round caps. Use sparingly: one per visual, max two. Never over a face or the logo, never combined with a highlight on the same words, never decorative/figurative, never with shadow/gradient/texture.
- **Icons** — simple, symbolic, single-color, abstract; no full outline, shadow, texture, or gradient. Represent Plan's program areas.

**Imagery vibe.** Warm, real, editorial. Direct eye-contact portraits for fundraising; dynamic real-moment action for advocacy/campaigns. Youthful energy throughout. No stock-photo gloss.

**Motion / interaction.** The print brand implies no animation; for digital UI this system uses restrained fades and 120–320ms `ease-standard` transitions. Hover = subtle brightness shift; press = slight scale-down. Focus = Plan-Blue/light-blue 2px ring.

**Borders, radii, shadows.** Highlight blocks and program blocks are square (0 radius). UI surfaces use a small consistent radius (sm 4 / md 8 / lg 16) and pill-shaped buttons & badges. The brand is otherwise flat — shadows are soft and reserved for interactive cards only (`--shadow-sm/md/lg`); doodles and icons carry no shadow. Transparency/blur are not part of the brand and are avoided.

**Layout.** Generous whitespace, clear hierarchy, "fewer and larger" images over many small ones. Logo sits in whichever corner best fits the composition with adequate contrast and clear margin.

---

## ICONOGRAPHY

Plan International maintains its **own icon set** on its Mediabank representing core work areas — *pendidikan inklusif, perlindungan dari kekerasan, hak anak perempuan, aktivisme kaum muda, tumbuh kembang anak, keterampilan & ketenagakerjaan (YEE)*. Icons are simple, symbolic, single-color, and abstract, following strict rules: no full outline, no shadow, no texture, no gradient. Approved fill/line color pairs are defined (e.g. Light Blue fill + Blue line; Yellow fill + Purple line).

**In this system:** the official Plan icon SVGs were **not** provided, so no icon-font or sprite is bundled. Where UI needs generic interface glyphs, substitute a stroke-based CDN set (e.g. Lucide) that matches the "simple, single-color, no-fill" style — and flag the substitution. Program-area icons must be sourced from Plan's Mediabank, not recreated. No emoji, no unicode-glyph icons. The one exception authored here is the **Doodle** component — the brand's own hand-drawn stroke device, which is decorative, not iconographic.

---

## Index / Manifest

**Root**
- `styles.css` — entry point; `@import`s all tokens (consumers link only this).
- `thumbnail.html` — homepage brand tile.
- `readme.md` — this file.
- `SKILL.md` — Agent-Skill wrapper.

**tokens/** — `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `fonts.css` (Poppins via Google Fonts).

**components/** (namespace `window.PlanIndonesiaDesignSystem_3e39b4`)
- `core/` — **Button**, **Badge**, **Card**
- `graphics/` — **Highlight**, **Doodle**, **StatCard**, **Quote**
- `forms/` — **Input**

*Intentional additions:* this is a brand-guidelines-only source (no component inventory was defined), so a standard set sized to the brand was authored. **Highlight**, **Doodle**, **StatCard**, and **Quote** are brand-specific primitives that encode the manual's signature graphic devices rather than generic UI parts.

**guidelines/** — foundation specimen cards (Colors, Type, Spacing, Brand).

**slides/** — sample deck built from the InnovAItion Challenge kick-off: `01-title`, `02-agenda`, `03-stats`, `04-timeline`, `05-closing` (1280×720 each).

**ui_kits/campaign/** — interactive InnovAItion Challenge landing + registration flow composing the components (see its `README.md`).

---

## Caveats
- **No logo files** were supplied. The system never reconstructs Plan's real logo; it renders "Plan Indonesia" + strapline in Poppins Bold as a placeholder wherever a mark belongs. Provide the official logo lockups (with/without strapline, reverse, no-flag, mono) to replace these.
- **No font binaries** were supplied. Poppins is loaded from Google Fonts (same typeface as specified). Arial and Georgia are system fonts. If licensed brand font files exist, add them under `tokens/` with `@font-face`.
- **No official icon set** was supplied — see ICONOGRAPHY. Program-area icons and brand photography must come from Plan's Mediabank.
- Photography throughout uses labelled placeholders; all real imagery must follow the safeguarding rules above.
