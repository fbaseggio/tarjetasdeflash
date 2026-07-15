# Spanish Flash Cards — Design

## 1. Purpose

Build a small, mobile-friendly Spanish vocabulary learning application for approximately four learners. The first version should be easy to host, understand, and change. It runs as a static website on GitHub Pages. The deployed local-first release preserves the selected profile, onboarding placement, daily session plans, activity summaries, latest per-word evidence, spaced-repetition due dates, and immutable session/round/attempt history in the browser. A later local phase adds exact in-round recovery and richer reporting; a still later phase adds Firebase Cloud Firestore for synchronization and shared standings across devices.

The application should make short practice sessions pleasant, preserve multi-day learning history, schedule useful reviews, and provide friendly standings. Its storage boundary should allow local browser data to be replaced or synchronized with Firestore without rewriting the quiz system.

## Implementation status — July 2026

### Implemented and deployed

- Static GitHub Pages application at `https://fbaseggio.github.io/tarjetasdeflash/` with no build step.
- Twenty-seven playful, honor-system profiles with per-browser recognition, greeting, and change-user behavior.
- A 100-entry placeholder vocabulary asset.
- An active, versioned 1,536-entry curriculum vocabulary derived from the project-provided Year 1 and Spanish II workbooks, with chapter order, year labels, four application bands, canonical lemmas, merged duplicate rows and senses, structured grammar metadata, and validation tests.
- A one-time, per-profile onboarding assessment with sixteen mixed core questions, six adaptive confirmation questions, persisted tentative placement, and no effect on streak statistics.
- Due-only frontier practice plus structured below-frontier audits, including Expanding 2 Foundation check-ins every other day and extra audit pressure when lower-tier misses appear.
- Random ten-word quiz rounds, balanced between five Spanish-to-English and five English-to-Spanish prompts.
- Four randomized choices with stable answer positions for both direction variants.
- Quality-gated distractors using structural class, part of speech, semantic affinity, Spanish spelling and approximate sound, an initial reviewed set of directional false cognates, and explicit `verbo`/`verbo-falso` rules; deterministic audit and simulation expose every backoff.
- Brief correct/incorrect feedback after every submission. When compact quiz text differs from the teaching form, a correct answer also reveals the complete pair; misses still advance quickly without exposing the answer.
- Active quiz rounds carry the same post-answer information into a compact last-result breadcrumb above the next prompt so learners can see what just happened without scrolling backward or pausing. When the quiz form was shortened, the full flashcard/teaching version is shown as a small secondary line on phones.
- Browser-local **Answer delay** setting with Off, Short, and Normal choices. Normal is the default 1.5-second pause; Short is one second.
- Round-robin reprise of missed words, first in the opposite direction and then alternating directions, with prior wrong choices struck through and disabled in the applicable direction.
- Final-only scoring of ten resolved words and all wrong submissions.
- Per-profile `localStorage` summaries for membership days, practiced days, current streak, completed quizzes, first-quiz-of-day error rate, and all-quiz error rate.
- A persisted daily practice session with an up-to-ten-word due/audit check-in, adaptive new-word presentations, and due-review rounds.
- Per-word, per-direction latest first-presentation evidence with frontier, audit, and repair mastery tracks.
- Tier coverage reporting for distinct tested words and their latest first-presentation result.
- A concise, single-column result review for onboarding, each daily-session stage, and extra quizzes, including each word's scheduled review gap as a demonstrated-mastery signal.
- A deduplicated whole-day vocabulary review available from the section-results screen.
- End-of-practice choices for another quiz or another full session on the same actual local date.
- A first-session-of-day results-sharing option with a generated Wordle-like achievement image, using the device share sheet with a clipboard fallback and no recipient or contact access.
- Multiple full sessions may share one calendar day while retaining distinct session identities; only the day's first completed quiz affects its streak and first-quiz baseline.
- A one-time calendar repair collapses legacy simulated future sessions onto the actual local date and corrects review dates that were inflated by the old testing shortcut.
- Versioned IndexedDB history for practice sessions, quiz rounds, and every submitted answer, including reprise attempts and exact question snapshots.
- Active-profile diagnostic JSON export containing local learning data, IndexedDB history, application and vocabulary versions, storage status, and browser context.
- A versioned portable per-concept mastery projection in diagnostic exports for later vocabulary and quiz-format migrations.
- The application version displayed in the site header.
- Automated tests for distractor validity and calibration, question generation, quiz/reprise behavior, profiles, recognition, onboarding, activity summaries, same-day repeated sessions, legacy calendar repair, word evidence, and scheduling.

### Next local-learning work

- Further editorial cleanup of phrases and source annotations in the official curriculum vocabulary; all formerly blank parts of speech now have inferred categories.
- Selective salvage of useful supplementary entries from the former 1,500-word testing list.
- Exact in-round recovery from the stored question and attempt history.
- Promotion/demotion rules that let the projected level safely influence the instructional frontier without whipsawing.
- More sophisticated vocabulary selection using recency, confidence, history, and learner preference.
- Full in-round reload recovery and local standings.

### Later work

- Firebase synchronization and shared cross-device history and standings.
- Additional question types, richer content, and authentication if needed.

## 2. Goals

- Present quick Spanish vocabulary quizzes with clear prompts and uninterrupted progression.
- Support a small invited group of named learner profiles in one browser initially.
- Track quiz sessions and individual answers over time.
- Track per-word progress and schedule spaced-repetition reviews.
- Generate follow-up quizzes from missed vocabulary.
- Show local activity summaries and standings for profiles using that browser.
- Add cross-device history and shared standings in a later phase.
- Keep hosting and expected backend usage free.
- Keep quiz logic independent from storage and interface code.

## 3. Non-goals for the MVP

- Passwords, private accounts, or strong identity verification.
- Protection against a learner selecting another learner's profile.
- A content-management interface for editing vocabulary.
- Audio, images, typed answers, or sentence exercises.
- Cross-device synchronization and shared standings in the first local release.
- Offline synchronization or installable-app behavior.
- General-purpose backup import while the current vocabulary remains test content; diagnostic export is implemented.
- Anti-cheating controls or high-stakes scoring.

## 4. Vocabulary universe

The active vocabulary universe is the 1,536-entry curriculum set at [`assets/vocabulary-official-v1.json`](assets/vocabulary-official-v1.json), with version and transformation metadata alongside it. It was derived from the project-provided Year 1 `Vocab for G.xlsx` workbook plus the Spanish II `spanishii_vocabulary.xlsx` workbook. Chapters remain the fine-grained curriculum order. Every entry has a `year` of first introduction and a `years` list for repeated prompts; Year 1 covers chapters 0–9 and Spanish II/Year 2 covers chapters 10–18. Application tiers are Foundation chapters 0–2, Everyday chapters 3–6, Expanding 1 chapters 7–9, and Expanding 2 Year 2 chapters 10–18. The former 1,500-entry testing set and original 100-entry placeholder remain in `assets/` only as possible supplementary and migration-reference material.

```json
{
  "id": "g-pedir-13unzbp",
  "spanish": "pedir",
  "english": "to ask for; to request; to order (food)",
  "lemma": "pedir",
  "partOfSpeech": "verb",
  "tier": "everyday",
  "year": 1,
  "years": [1],
  "chapter": 4,
  "chapters": [4, 8],
  "category": "chapter-4",
  "senses": ["to ask for", "to request", "to order (food)"],
  "semanticTags": ["food", "food:restaurant"],
  "distractorTraits": ["verbo"],
  "grammar": { "stemChange": "e:i", "irregularPreterite": "yes" }
}
```

Requirements:

- `id` is stable and unique. Historical records refer to this ID, so changing display text must not change the ID.
- `spanish` and `english` are clean answer text displayed to learners; source notation such as `pedir (e:i)` is represented as `spanish: "pedir"` plus grammar metadata.
- `lemma` is the canonical lexical identity; `senses` preserves source meanings merged under one unambiguous Spanish prompt.
- `year` is the first course-year introduction and `years` preserves later repeats. `chapter` is the first curriculum introduction and `chapters` preserves later repetitions. `category` records the source category for later imports and chapter-derived categories for the original Year 1 import.
- `semanticTags` contains project-authored broad and narrow topic tags adapted from the Instituto Cervantes *Nociones específicas* organization. `distractorTraits` contains exceptional surface-form classes such as `verbo` and `verbo-falso`.
- Source-row references and alternate source forms remain available for editorial auditing. Personal columns such as individual learners' self-reports are excluded from the shared vocabulary.
- Automated dataset tests validate required fields, unique IDs and Spanish prompts, tier counts, structured grammar examples, and four-choice generation in both directions. Runtime generation also checks that enough distinct displayed choices can be formed and fails visibly when vocabulary cannot be loaded.
- Question generation must not assume that display text is unique. Distractor choices must be deduplicated by their displayed answer text.

The vocabulary file remains a static application asset in the MVP. Moving vocabulary into Firestore is unnecessary until browser-based editing or dynamic decks are desired.

The first official import merged 80 repeated Year 1 source rows into 998 distinct Spanish prompts, supplied the workbook's missing translation for `cero`, and retained structured grammar metadata. The Spanish II import read 549 rows from chapters 10–18, producing 544 unique Year 2 prompts: 525 brand-new entries, 19 exact repeats merged into existing Year 1 entries, and 5 duplicate Spanish II rows merged internally. Later editorial passes inferred all previously blank parts of speech, corrected geographic names and several conjugated forms, and the enlarged dataset now classifies 28 proper nouns, 31 numbers, 29 questions, 73 phrases, and 10 conjunctions; dataset validation rejects any remaining `unknown` category. The first-pass semantic taxonomy now assigns at least one broad and narrow tag to every entry using bounded word/phrase rules, source-category rules, safe Spanish morphological stems, and reviewed overrides for otherwise untagged curriculum words. It marks 179 bare infinitives as `verbo`, nine noun lookalikes—`mujer`, `celular`, `lugar`, `suéter`, `azúcar`, `calamar`, `deber`, `porvenir`, and `titular`—as `verbo-falso`, and 53 entries in 24 curated lexical families. Clear comma-separated Spanish alternatives that can be quizzed independently are split into separate active entries, while punctuation and grammar-variant comma entries remain combined. The former testing dataset keeps its own attribution documentation and is not loaded by the application.

### 4.1 New vocabulary onboarding checklist

Before adding a new batch of vocabulary to the official dataset:

1. **Preserve the source.**
   - Keep the original file or sheet unchanged.
   - Record source name, date received, row count, and any source columns intentionally ignored.
   - Note whether the new words are a supplement to the current dataset or a replacement migration.

2. **Normalize learner-facing text.**
   - Split source notation such as stem changes, gender variants, or usage notes into structured metadata where practical.
   - Keep `spanish` and `english` as the full teaching pair shown to learners.
   - Split true comma-separated Spanish alternatives into separate active entries when each form should be quizzed independently; keep punctuation, gender, number, and short-form adjective variants together.
   - Add `quizSpanish` or `quizEnglish` only when the generated compact form needs a human override.
   - Preserve accents, `ñ`, opening punctuation, and meaningful articles in teaching text.
   - Review compact quiz forms for punctuation clues: unmatched `¡`/`¿`, commas, parentheticals, abbreviations, and capitalization should not make one choice stand out unless the punctuation is part of the skill being tested.

3. **Sanity-check translations.**
   - Verify that each Spanish–English pair is a plausible direct translation in the intended beginner/high-school context.
   - Flag entries where the English gloss is too broad, too narrow, archaic, regional, slangy, or context-dependent.
   - Check that multi-sense English glosses do not mix unrelated meanings under one Spanish prompt unless the Spanish really covers them.
   - Check directionality: a Spanish word may accept an English gloss in recognition while the English prompt may be too ambiguous for production.
   - Add usage notes or `quizSpanish`/`quizEnglish` overrides when the teaching pair is right but the quiz form would be misleading.
   - Review suspicious pairs manually before release rather than relying only on automated tests.

4. **Merge and identify entries.**
   - Merge repeated Spanish prompts only when they are the same teachable word or phrase.
   - Preserve multiple English senses in `senses`.
   - Assign stable IDs that will survive small display-text edits.
   - Mark true replacements or deletions explicitly so existing progress can be migrated or retired intentionally.

5. **Classify grammar and structure.**
   - Fill `partOfSpeech` for every entry; no `unknown` values are allowed.
   - Separate questions, phrases, numbers, proper nouns, verbs, adjectives, adverbs, nouns, and other needed categories.
   - Store grammar hints such as gender, plural-only forms, stem changes, irregular forms, and regional usage as metadata rather than quiz text when possible.
   - Recompute `verbo` and `verbo-falso` traits after import.
   - Recount structural classes after import. If the new batch adds many questions, phrases, proper nouns, or numbers, confirm that each class still has enough same-class distractors.

6. **Place entries in the learning path.**
   - Assign chapter or introduction order.
   - Derive the application tier: Foundation, Everyday, Expanding 1, or Expanding 2.
   - For words that should be presumed known for advanced learners, make sure their tier reflects that expectation.

7. **Tag meaning and relationships.**
   - Assign at least one broad and one narrow `semanticTag` to every entry.
   - Add or extend lexical-family relationships when related forms could become useful distractors.
   - Add false-cognate relationships where a tempting wrong answer is pedagogically useful.
   - Review transparent true cognates so English-to-Spanish distractors do not become too easy. The current chooser downweights transparent Spanish candidates unless they are the correct answer or an explicit false-cognate lure.
   - Protect useful false-cognate lures from the transparent-cognate penalty; for example, a tempting but wrong lookalike should remain available when it teaches a real confusion.
   - Review lexical-family relationships separately from cognates. Family affinity should not create grammatical clues or admit a candidate from an incompatible structural class.

8. **Check quiz-display safety.**
   - Confirm compact quiz text removes accidental clues from parentheses, commas, articles, capitalization, and terminal punctuation.
   - Make sure questions mostly compete with questions, proper nouns with proper nouns, numbers with numbers, and phrases with compatible phrases.
   - Spot-check entries whose correct answer differs from the teaching pair, because those should reveal the full pair after a correct answer.
   - Spot-check English-to-Spanish questions involving very transparent Spanish forms such as near-identical cognates; these should usually be correct answers or low-priority distractors, not giveaway wrong choices.
   - Spot-check Spanish-to-English questions involving very broad English glosses such as “to go,” “thing,” “kind,” or “place,” because they often need semantic tags or manual sense cleanup to avoid weak distractors.

9. **Run automated validation.**
   - Run dataset tests for required fields, unique IDs, unique displayed prompts where required, valid part-of-speech values, semantic coverage, and four-choice generation in both directions.
   - Run distractor calibration and inspect fallback rates.
   - Run the audit report and review a sample of fallback, broad-semantic, cognate-penalized, false-cognate, lexical-family, question, phrase, proper-noun, `verbo`, and `verbo-falso` cases.
   - Inspect all or most format-fallback cases after a large import. Fallbacks are not automatically wrong, but each one is a signal that semantic tags, structural classification, or lexical-family metadata may need another pass.
   - Generate random question samples in both directions after the audit. Human inspection is still the best way to catch “obvious by shape” choices that satisfy formal rules.

10. **Plan history migration.**
   - Map exact overlapping words and senses from the previous dataset.
   - Preserve portable mastery for exact semantic matches.
   - Avoid attaching history to ambiguous overlaps unless reviewed.
   - Bump dataset metadata and storage/migration code only as much as the change requires; ordinary same-dataset metadata edits must not invalidate local learning or onboarding records.

11. **Release deliberately.**
    - Update vocabulary metadata with counts and transformation notes.
    - Update tests whose expected counts changed.
    - Update the app/cache version when browser assets need a fresh load.
    - Test locally, then commit the vocabulary, scripts, tests, metadata, and design notes together.

## 5. Core concepts

The system keeps these concepts separate:

- **Vocabulary item:** durable source content such as `manzana` / `apple`.
- **Question:** one generated prompt, answer, direction, and set of four choices.
- **Practice session:** one day's coherent learning flow: a check-in, new-word presentation, and due reviews.
- **Quiz round:** an ordered group of at most ten questions within a practice session, or an optional standalone extra-practice round.
- **Attempt:** one submitted answer to one question.
- **Word progress:** one profile's scheduling and performance state for one vocabulary item.
- **Profile summary:** repairable aggregate data used to display standings efficiently.

This separation allows the same vocabulary item to appear in different directions and follow-up rounds while retaining an accurate history of what the learner saw.

## 6. Question generation

### 6.1 Initial question type

The MVP uses four-choice multiple choice in both directions. Each ten-question initial pass contains five Spanish-to-English and five English-to-Spanish questions, shuffled into a mixed order. Every vocabulary item has a stable four-choice variant in each direction: exactly one correct answer and three distractors.

### 6.2 Question selection

The implemented selector never repeats a vocabulary item within one quiz round. Daily selection is stage-specific:

1. The check-in uses up to ten eligible words. Below-frontier audit slots prioritize untested or due words; remaining slots use due frontier words, prioritizing recent misses. If room remains, supplemental below-frontier audit words fill the check-in so normal sessions do not feel too small. Everyday learners audit Foundation; Expanding 1 learners audit Foundation and Everyday; Expanding 2 learners audit Everyday and Expanding 1 daily and Foundation every other day. Lower-tier weakness increases that tier's audit slots.
2. The new-word stage chooses unseen words from the learner's tentative frontier. Each profile has a switchable **New words** setting. **Mixed** uses the original weighted frontier sampling, underweighting transparent cognates without banning them. **Topic groups** introduces words in curriculum order by chapter and source category, aiming for natural thematic packets of roughly 7–13 words and splitting larger categories into smaller packets. Both modes gently reduce the normal fifteen-word intake by one word for each eight due-review backlog items, with an eight-word floor while vocabulary remains available. If the current frontier tier has too few unseen words left, the planner finishes those words and then borrows from the next higher tier rather than creating a tiny session.
3. The review stage includes due frontier and repair words plus that day's newly presented words, split into rounds of at most ten. Successfully audited below-frontier words do not enter ordinary reviews.
4. Optional extra-practice rounds use eight eligible frontier words plus tier-appropriate audit words and exclude every word already questioned that calendar day.

The frontier scheduler starts clean initial retrieval at three days and then advances through 7, 14, 30, and 60 days. A first-presentation mistake resets the word to one day. A same-day success records evidence without lengthening the gap. Immediate reprise answers remain recovery practice and do not lengthen the interval. Transparent cognates can advance faster when recalled cleanly: moderate English-to-Spanish successes advance two ladder steps, strong Spanish-to-English successes advance two steps, and strong English-to-Spanish successes advance three steps. New-word introduction is throttled from the total due-review backlog: `max(8, 15 - floor(backlog / 8))`, limited by available unseen vocabulary at the current frontier or higher tiers.

Below-frontier words use a separate audit track. A clean Foundation audit goes directly to a 60-day gap; clean Everyday and Expanding 1 audits for higher-frontier learners go to 30 days. A miss revokes presumed mastery and enters repair at one day. Two later clean, spaced repair reviews restore the word to its tier's audit gap; a same-day corrective review does not count toward those two spaced successes.

Every first-pass question retires its word from ordinary selection for that local calendar day. A check-in or assessment miss may receive one later corrective due-review that day; once that review occurs, the word is retired. Immediate reprises are exempt because they complete the current question rather than create a new first-pass presentation.

Selection remains an interchangeable strategy. Later refinement should use staleness, confidence, direction-specific evidence, and oldest-due ordering within each priority bucket without changing question rendering or scoring.

### 6.3 Distractor selection

The distractor chooser selects three translations from other vocabulary items. It must:

- Exclude the correct vocabulary item.
- Exclude text equal to the correct displayed answer.
- Prevent duplicate displayed choices.
- Stop with a clear error if four distinct choices cannot be formed.

The implemented chooser uses hierarchical weighted sampling without replacement. Candidate safety, structural compatibility, and affinity quality are deliberately separate. A candidate is rejected when it is the target entry, has the same compact displayed answer or prompt, duplicates another choice, represents the same merged lemma and sense, is another defensible translation, or belongs to an incompatible structural class. Ordinary candidates must share the target's part of speech. Questions, proper nouns, numbers, and phrases are isolated classes. The only cross-part-of-speech exception is a `verbo`/`verbo-falso` surface confuser with independently meaningful spelling or sound affinity.

Candidate weights then increase according to independent, potentially compounding features:

- Same part of speech.
- Question structure: a question has a very strong affinity for other questions, while a question has zero eligibility as a distractor for any non-question target.
- Proper-name structure: proper nouns compete only with proper nouns; ordinary targets can never receive a capitalized proper-name distractor.
- Same curriculum tier and proximity in chapter order.
- Same semantic family or topic.
- Verbo surface form: bare infinitives and the nine noun lookalikes use a separately calibrated eligibility and weighting policy.
- A known false-cognate relationship between prompt and answer.
- Similar Spanish spelling or pronunciation.
- Similar answer form or length when that makes the alternatives grammatically homogeneous.
- A learner-specific history of selecting one entry for the other, once enough history exists.

False-cognate relationships may be directional: a particular English answer can be tempting for a Spanish prompt without the reverse direction being equally useful. Sound and spelling similarity should be computed between the relevant Spanish forms even when the displayed answers are English. Explicit editorial relationships take precedence where automatic similarity would be misleading.

English-to-Spanish selection also computes how transparently each Spanish candidate reveals its own English meaning. Normalized lemma-to-gloss similarity currently identifies 142 strong and 158 moderate non-proper cognates across the 1,536-word official corpus, with reviewed additions such as `profesor/a` whose stored gloss is “teacher.” Strong candidates receive a `0.12` multiplier and moderate candidates `0.35`; they remain possible but rarely outrank equally good opaque alternatives. This penalty is directional, never affects a correct answer, excludes proper names, and is suppressed when the candidate is an explicit false-cognate lure for the current prompt.

Weights are configuration, not domain invariants. The first selection tier requires a narrow semantic match, meaningful spelling/sound similarity, an explicit relationship, or a special homogeneous class such as questions, proper nouns, or numbers. If fewer than three choices are available, the chooser backs off to same-part-of-speech broad semantic matches. Only after both affinity tiers are exhausted may it use a same-format, same-part-of-speech fallback. Tier, chapter, and answer length can adjust weights but can never qualify a candidate by themselves. Learner-confusion data has a defined scoring hook but is not yet populated. Selection remains random within each tier, so questions do not become fixed category-matching exercises.

A **verbo** is a curriculum entry categorized as a verb whose displayed Spanish is one bare word ending in `-ar`, `-er`, or `-ir`. A **verbo-falso** is a single-word noun longer than three letters whose lemma has the same ending. Verbs now draw primarily from all semantically or orthographically related verb entries, rather than being limited to bare infinitives. A verbo/verbo-falso pair is eligible across part-of-speech boundaries only when spelling or approximate sound independently makes it a plausible surface-form confusion; the shared ending alone is insufficient. Verb expressions and conjugated forms remain separate structural classes.

The first curated lexical-family set contains 24 families and 53 entries, including `invitar`/`invitado`, `llegar`/`llegada`, `desayunar`/`desayuno`, and `nacer`/`nacimiento`. Lexical-family affinity receives a strong weight only after structural compatibility; it cannot place a noun among verb answers or otherwise create a grammatical clue. A family member is still rejected whenever it could also be a valid answer.

Teaching text remains exactly as imported. Generated questions use compact quiz text: Spanish parentheticals, stem-change notes, abbreviations, slash alternatives, articles, and terminal punctuation are removed when they would create accidental clues. English quiz text is role-aware. English prompts preserve meaning-bearing parentheticals such as `for (a period of time)` or `to go out (with)`, because those clarify the Spanish target without appearing in the Spanish answer. English answer choices fold meaning-bearing parentheticals into natural text, such as `for a period of time` and `to go out with`, while dropping source notes, abbreviation notes, regional notes, and optional noun modifiers. The first top-level semicolon gloss is used without being confused by semicolons inside parentheses. Incidental initial capitalization is normalized outside proper nouns, questions, numbers, and all-caps forms such as `OK`. Spanish noun articles are omitted consistently across prompts and choices, preventing gender or the exceptional article-free form of a `verbo-falso` from revealing an answer. Optional `quizSpanish`, `quizEnglish`, `quizEnglishPrompt`, and `quizEnglishAnswer` fields can override this safe default. Thus teaching may show `el jugo (de fruta)` while a quiz asks `jugo`, `sacar/tomar fotos` becomes `sacar fotos`, `salir con` is answered as `to go out with`, and `desde hace` can be prompted as `for (a period of time)`.

There is no unrelated baseline tail. `npm run audit:distractors -- 200 40` produces a deterministic Markdown-style report with compact questions, every distractor's part of speech, selection tier, reason flags, quiz-text shortening counts, and aggregate backoff rates. Full two-direction calibration keeps plain same-format fallback below 5% of both choices and questions; every fallback remains visible for later semantic or editorial improvement.

Implementation status:

1. [x] Pure candidate scoring with an injectable random source and explicit reason flags for each weight multiplier.
2. [x] Weighted sampling without replacement while retaining hard validity checks and stable generated questions.
3. [x] Deterministic audit and simulation reporting affinity reasons, broad-semantic backoff, format fallback, and compact-text use.
4. [x] Remove the unrelated baseline tail and enforce homogeneous structural classes.
5. [x] Immutable attempts record distractor entry IDs, weights, reasons, and the selected entry ID.
6. [x] Add a first-pass Cervantes-inspired broad/narrow semantic taxonomy covering every entry.
7. [x] Add compact quiz forms, preserve full teaching forms, and prevent lexical-family relationships from creating grammatical clues.
8. [x] Downweight transparent true-cognate distractors in English-to-Spanish questions while preserving false-cognate lures.
9. [ ] Continue editorial review of semantic tags, lexical families, and cognate exceptions, then use accumulated selections to personalize learner-confusion weights.

### 6.4 Answer position

After the correct answer and three distractors are selected, all four choices are shuffled with Fisher–Yates. The correct answer has no fixed slot and its position should be approximately uniform over many questions.

Generated questions remain stable for the duration of a quiz. Re-rendering a page or selecting an answer must not reshuffle the choices.

## 7. Practice sessions and quiz-round behavior

### 7.1 Main flow

1. The learner selects or resumes a profile.
2. The application prepares or resumes the learner's daily practice session.
3. The learner completes an up-to-ten-word due/audit check-in, including reprise of any misses; each submission receives brief feedback before automatic advancement.
4. The application explicitly presents up to fifteen new Spanish/English pairs, reduced when the due-review backlog is high.
5. Due words and the newly presented words appear in quiz rounds of at most ten words.
6. Each round continues until every vocabulary item has been answered correctly.
7. Only after all stages does the result screen show aggregate right and wrong counts and offer a concise stage-by-stage review.

The current question number is visible during the initial pass, followed by the number of unresolved review words. Running right and wrong counts are not displayed. A submitted answer cannot be changed, because changes would make attempt history ambiguous.

Each question can first show only the prompt for a brief recall pause, then reveal the four choices automatically. This keeps the flow multiple-choice while nudging the learner to try active recall before scanning alternatives. The browser-local **Answer delay** setting controls this pause: Off reveals choices immediately, Short uses a one-second pause, and Normal uses the default 1.5 seconds.

After auto-advancing, the next active quiz or assessment screen keeps a compact summary of the previous answer above the prompt. Correct summaries may show the compact prompt/answer pair, reprise reminders, and—when quiz text differs from teaching text—the full flashcard/teaching pair with a small card cue. On narrow screens, secondary details move to their own lines to keep the main result readable. Wrong summaries show only what the learner chose for the prompt; they do not reveal the correct answer. The breadcrumb clears at the beginning of a new round and is separate from immutable attempt history.

When the previous answer completes a round or onboarding assessment, the application shows a small completion state in the quiz panel instead of immediately leaving. That state preserves the final answer's last-result breadcrumb and provides one button to continue the session, view the session summary, or see the starting-point result.

### 7.2 Scoring

Each quiz round records every submitted answer. Correctly resolving a vocabulary item contributes one right answer; every incorrect submission contributes one wrong answer. A full ten-word round therefore ends with `10 right` and `N wrong`; the daily session result aggregates its check-in and all due-review rounds, so its right count can be larger.

The result screen appears only at completion and offers a concise review, optional extra practice, and another full session on the same actual day. It reports Demonstrated **Mastery** as a weighted count out of the full corpus, **Projected** mastery as a conservative percentage inferred from tier-level evidence, a projected level label, and a 1–4 placement-readiness score. Completed full-session result screens show a preview of a simple share card and offer **Text my friends**, so the learner can see exactly what will be sent even after the first session of the day. The application generates the same card as a 1200×630 PNG containing the learner's display name, distinct words practiced, new words, mastery gained today, current streak, and public application URL, then attaches that image and a concise editable message to the browser's native share sheet. The message contains the link, Demonstrated Mastery, Projected mastery, projected level, and retries, while avoiding a separate Web Share URL field to reduce multi-bubble text-message behavior. The recipient application is chosen by the learner; when native sharing is unavailable, the text is copied to the clipboard. Standalone extra quizzes do not offer this action.

The stage-by-stage review and the “all words seen today” review also allow optional local manual priority changes for each reviewed word. **More practice** records a per-word override and pulls the next review one scheduler step sooner; **Know it** records a per-word override and pushes the next review two scheduler steps later; **Normal** removes the override without rewriting the recorded answer history. These controls are deliberately absent during the live quiz, so they adjust future scheduling without changing right/wrong counts or the evidence trail.

Completing a quiz also updates a per-profile practice summary in local browser storage. Calendar dates use the device's local timezone. The first completed quiz on a date is that day's baseline quiz: it adds one practiced day, advances the streak when the preceding practice date was yesterday, and contributes to the daily first-quiz error rate. Later quizzes that day do not change the streak or baseline rate, but do increase the total quiz count and all-quiz error rate.

Both error rates are calculated as wrong submissions divided by all submissions (`wrong / (right + wrong)`). Membership days count calendar days inclusively from the date the profile was first used on this browser. The result screen reports current streak, membership days, practiced days, total quizzes, daily first-quiz error rate, and all-quiz error rate.

### 7.3 Follow-up quizzes

Review is a continuation of the same quiz and contains only unresolved vocabulary from the initial pass.

Default behavior:

- First repeat a missed word in the direction opposite its initial question.
- When the first opposite-direction reprise is answered correctly, remind the learner of the original miss using both values, for example: `Last time you answered “dog” for “rojo”.` This appears after the correct first reprise and is carried into the next-question or round-complete last-result breadcrumb. Later same-direction reprises already retain and strike through their prior wrong choices, so they need no additional reminder.
- Alternate direction after every additional wrong review answer.
- Briefly show whether the submitted answer was correct. After a correct answer whose compact quiz text differs from either imported teaching form, show the complete Spanish/English pair for about 1.4 seconds; unchanged pairs need only the ordinary correctness feedback. A first opposite-direction reprise with its reminder remains visible for about 2 seconds. A miss marks only the selected answer as incorrect, does not reveal or highlight the correct answer, and advances after about 850 milliseconds. Reduced-motion timing remains shorter.
- Disable all choices during the short feedback interval, then advance automatically.
- Maintain stable choices and answer positions separately for each direction.
- Display previously selected wrong choices with a strike-through and disable them whenever that direction returns.
- If another wrong answer is selected, record it for that direction and return the opposite-direction variant to the end of the review queue.
- Record each new submission as a separate attempt linked to the same question.

Review proceeds round-robin until all missed vocabulary has been answered correctly.

### 7.4 Daily practice session

A **practice session** is the daily learning unit. It contains three stages, each rendered in short quiz rounds rather than one intimidating continuous test:

1. **Check-in:** up to ten eligible words with brief per-answer feedback and automatic advancement. Structured slots audit due or untested below-frontier vocabulary; remaining slots use due frontier words, prioritizing misses, then supplemental below-frontier audit words when needed to keep the session substantive. No word may appear in more than one check-in on a calendar day. The first completed quiz on a local calendar date supplies that day's baseline error rate and streak credit.
2. **New words:** normally about fifteen new entries, adaptively reduced as the due-review backlog grows, but with a normal floor of eight new entries while unseen vocabulary remains. The planner exhausts the current frontier tier first and then borrows from higher tiers if needed. Per-profile new-word style controls whether introductions are mixed or grouped by source theme; Gideon defaults to topic groups while other profiles default to mixed, and learners can switch either way without changing existing review history. Each word is explicitly presented as a Spanish/English pair before later retrieval; genuinely new vocabulary must not rely on a lucky multiple-choice guess as its only exposure.
3. **Due reviews:** all words due under the scheduler, presented in ten-question rounds. Reviews take priority over new words when a backlog develops.

The implemented target is fifteen new words per study day when reviews are light, minus one new word for each eight due-review backlog items, with an eight-word floor while enough unseen words remain. Mixed new-word sampling underweights helpful transparent cognates rather than banning them: non-transparent words use weight `1.0`, moderate cognates `0.6`, and strong cognates `0.35`. Topic-grouped intake preserves source order within chapter/category packets so learners do not meet isolated weekdays, numbers, or city words one at a time. A future release may also apply the proposed soft cap of approximately ninety first-pass prompts or fifteen minutes. The exact limits remain configuration rather than domain invariants and should be adjusted after observing the learners.

The standalone quiz and reprise behavior is the interaction primitive used by the check-in and due-review stages. Newly presented words are due for retrieval in Step 3 the same day. A practice session may contain several stored quiz rounds, but streak and first-quiz-of-day reporting are awarded only once per local calendar day.

A completed session or extra quiz offers **Start another full session today**. Each repeated session receives a distinct session key but retains the device's actual local calendar date. Repeated same-day sessions contribute quiz totals and word evidence but cannot manufacture practice days, streak credit, or early due dates.

## 8. Profiles and identity

The first release supports a small invited set of profiles stored in the browser. A profile has a stable ID, display name, optional color or avatar marker, and timestamps. On a device without a remembered profile, the learner answers two playful recognition questions using Spanish choices:

| Favorite animal | Favorite color | Profile ID | Display name |
|---|---|---|---|
| Elefante | Azul | `franco` | Franco |
| Panda | Morado | `rebecca` | Rebecca |
| Pingüino | Rojo | `milo` | Milo |
| León | Verde | `gideon` | Gideon |

The `León` / `Morado` combination opens an additional invitation check: “What is the air-speed of a swallow?” Choosing the question “What do you mean, an African or a European swallow?” opens a picker containing Seth, Cristina, Jeremy, Hannah, Natalie, Jackie, Lisa, Sherry, Lynette, Kari, Sam, Ajit, Jake, Karen, Tricia, Anne, and Jamie. “Someone else…” accepts a case-insensitive, whitespace-tolerant full-name match for Graham Chapman, John Cleese, Terry Gilliam, Eric Idle, Terry Jones, or Michael Palin. Each accepted name is a stable profile with independent learning history. Other combinations, invitation answers, or custom names do not identify a known profile and prompt the learner to try again. A successful match stores only the active profile ID in `localStorage`, greets that learner by name on later visits, and skips the questions. A quiet **Change user** action clears the active selection without deleting any profile's learning history.

Currently, each profile's activity summary, onboarding placement, daily session plans, latest first-presentation result by word and direction, review schedule, quiz rounds, and immutable attempts persist across visits made with the same browser and GitHub Pages origin. Continuously revised level evidence, exact in-round restoration, and local standings remain next-phase work. Clearing site data, using private browsing, changing browsers, changing the site's origin, or moving to another device will not carry local history with the learner.

When shared persistence is added, Firebase Anonymous Authentication will identify a browser installation while the application profile continues to identify the learner:

- A Firebase anonymous user identifies a browser installation.
- A profile identifies the human whose learning history is being updated.
- Multiple anonymous browser identities may submit activity for the same profile.

This is an honor-system design. Anyone who can open the site can select any profile. A later release can attach each profile to a permanent Firebase login without changing historical profile IDs.

### 8.1 Estimated learner level — partially implemented

Each profile will retain a coarse level estimate independently from any vocabulary dataset version:

```text
estimatedTier          // foundation, everyday, expanding1, or expanding2
confidence             // low, medium, or high
receptiveScore         // Spanish-to-English evidence
productiveScore        // English-to-Spanish evidence
wordsAssessed
assessedAt
evidenceDatasetVersion
```

Only first attempts on previously unseen or check-in words contribute primary placement evidence. Immediate reprise answers do not raise the estimate, because they measure recovery rather than durable knowledge. Spanish-to-English and English-to-Spanish evidence remain separate because recognition is generally easier than production, even while both use multiple choice.

The implemented onboarding estimator asks sixteen core questions—four per tier—then six confirmation questions in the apparent boundary tier. A tier is tentatively solid at 70% first-attempt accuracy. It stores `knownThrough`, `learningFrontier`, low confidence, per-tier scores, and direction-specific evidence for all twenty-two assessed words. The assessment gives brief feedback and advances automatically, does not reprise missed questions, and does not count as quiz activity or streak credit. Its placement screen offers a tier-grouped review of all assessment answers.

The result screen now displays an estimated level derived from Projected mastery, using breakpoints that roughly shoe-horn the original onboarding bands into the four-tier corpus: Foundation below 25%, Everyday from 25–49%, Expanding 1 from 50–69%, and Expanding 2 from 70% upward. Projected mastery is based on direct first-attempt evidence in each tier plus strong downward inference from harder tiers: clean Expanding 2 evidence can raise confidence about Foundation, Everyday, and Expanding 1 even if those tiers have not been sampled heavily. The inference is one-way only; easy-word success does not raise harder-tier estimates. Direct lower-tier misses quickly cap that optimism, so a learner who knows harder words but misses an easier audited word is treated as having a real local gap.

The result screen also displays a separate placement-readiness score from 1.0 to 4.0. This score is `1 + Foundation strength + Everyday strength + Expanding 1 strength`, rounded to one decimal, so it measures readiness for a frontier based on strength in the tiers below that frontier rather than requiring mastery of the frontier itself. A value around 3.5 therefore means “Expanding 2 is a plausible frontier,” not “Expanding 2 is already mastered.” These labels are motivational/reporting evidence only for now; they do not automatically rewrite the stored learning frontier.

All below-frontier words are provisionally presumed known, while observed misses revoke that presumption word by word. Foundation confirmations enter a 60-day audit pool; Everyday and Expanding 1 confirmations for higher-frontier learners enter a 30-day pool. Audit misses enter active repair until two clean spaced reviews restore presumed mastery. Lower-tier check-in pressure increases immediately when a tier has two or more misses among its four most recent latest word results, or once at least ten tested words show below-95% latest-result success. Promotion/demotion rules that safely convert Projected mastery into frontier changes remain planned.

When vocabulary changes, the coarse level estimate remains as a prior. Confidence is rebuilt against the new dataset, while exact semantic word matches retain their full word-level history. Thus a dataset migration neither discards useful knowledge evidence nor treats every approximate match as certain.

## 9. Persistence

### 9.1 Storage boundary

The quiz domain remains independent from persistence. The current app coordinates a `localStorage` learning store and a versioned IndexedDB history store behind small modules. A more complete shared interface remains planned for profiles, practice sessions, quiz rounds, attempts, per-word progress, level evidence, summaries, and exact in-progress round state. This preserves a path to synchronization without coupling quiz rules to IndexedDB or Firestore.

### 9.2 Initial browser storage

The working release stores active-profile selection, compact per-profile activity summaries, completed onboarding placement, per-tier onboarding scores, daily session plans, per-word directional first-presentation evidence, and review due dates in `localStorage`. IndexedDB database `tarjetas-learning-v2`, schema version 1, stores practice-session snapshots, quiz-round snapshots, and every submitted answer. Each attempt snapshots its prompt, choices, correct and selected answers, direction, stage, phase, sequence, timestamps, and preceding attempt for that word.

A reload resumes the saved practice stage and restarts an unfinished quiz round without recording its abandoned clicks. Exact reconstruction from the already stored round definition and attempts remains to be implemented. The planned fuller local release also moves or projects these records into IndexedDB-backed sources of truth for:

- Profiles and local summary counters.
- Exact current-round state and recovery.
- Per-profile, per-word scheduling state.
- The generated state of an in-progress quiz so a reload does not reshuffle it.

The browser records use versioned key prefixes, dataset ID compatibility checks, and stable profile and vocabulary IDs. Same-dataset vocabulary metadata revisions update the stored dataset version but preserve compatible local onboarding, learning, activity, and daily-session records. If a previous release leaves the compact learning summary suspiciously sparse, the app can replay main-question attempts from IndexedDB history to recover most per-word evidence before planning the next session. Diagnostic exports also contain a versioned per-concept mastery projection. Activation of official vocabulary v1 intentionally advanced the local-storage and IndexedDB generation and erased all prior learning, onboarding, activity, and immutable attempt history while preserving the remembered profile identity. Later vocabulary revisions should migrate compatible mastery rather than repeat this early-development reset.

### 9.3 Later shared service

Cloud Firestore will become the shared backend when cross-device support is implemented. It can be called directly from the static browser application and is ample for the expected data volume on its free quota.

Firebase configuration values used by the web client are public application identifiers, not secrets. Administrative credentials and service-account keys must never be committed or placed in browser code.

The first synchronization release may use an explicit one-time migration from the browser database. General-purpose export/import is not required for the test vocabulary phase.

### 9.4 Planned data stores and Firestore collections

The browser stores below map to corresponding Firestore collections later.

#### `profiles/{profileId}`

```text
displayName
color
createdAt
updatedAt
quizCount
firstPassAttemptCount
firstPassCorrectCount
followUpAttemptCount
wordsSeenCount
lastActiveAt
estimatedTier
levelConfidence
receptiveScore
productiveScore
wordsAssessed
levelAssessedAt
evidenceDatasetVersion
```

The count fields are cached summaries for standings. Attempt and session records remain the source of truth, so summaries can be rebuilt if needed.

#### `practiceSessions/{practiceSessionId}`

```text
profileId
effectiveDate          // actual local YYYY-MM-DD learning date
sessionKey             // date for the first session, then date#2, date#3, ...
repeatedSameDay        // true after the day's first full session
status                 // "in-progress", "completed", or "abandoned"
checkInWordIds
newWordIds
reviewWordIds
currentStage
quizRoundCount
correctCount
wrongCount
startedAt
completedAt
```

#### `quizRounds/{quizRoundId}`

```text
profileId
practiceSessionId      // null for standalone extra practice
stage                  // "check-in", "due-review", or "extra"
status                 // "in-progress", "completed", or "abandoned"
requestedQuestionCount
actualQuestionCount
correctCount
wrongCount
startedAt
completedAt
```

#### `attempts/{attemptId}`

```text
quizRoundId
practiceSessionId
profileId
vocabularyId
precedingAttemptId     // null on first presentation
promptLanguage
answerLanguage
promptText
choices                // snapshot of the four displayed choices
correctAnswer
selectedAnswer
correct
questionIndex
answeredAt
```

Text and choices are snapshotted so the historical record still describes the question accurately if vocabulary content later changes.

#### `wordProgress/{profileId_vocabularyId}`

```text
profileId
vocabularyId
seenCount
firstPassCorrectCount
firstPassIncorrectCount
consecutiveCorrect
intervalDays
lastAnsweredAt
nextDueAt
spanishToEnglishStats
englishToSpanishStats
vocabularySenseVersion
```

This record is the input to spaced-repetition selection. Follow-up attempts increase practice history but do not advance `consecutiveCorrect` or `intervalDays`.

### 9.5 Writes and consistency

- Create an immutable attempt record for every submitted answer.
- Complete a quiz-round record only after all its questions are answered, and complete its parent practice-session record only after the intended stages finish.
- Atomically record an attempt and update word progress and summary counters when the storage engine supports transactions.
- Never silently delete historical attempts.
- Store timestamps as absolute UTC instants and display them in the learner's local time zone.
- When Firestore is added, use server timestamps, transactions or atomic batches, and atomic increments so simultaneous activity from two devices is not lost.

If a summary update fails after an attempt is preserved, a repair routine can recalculate summaries from the immutable records.

## 10. Standings and reporting

The current result screen reports the active learner's streak, membership days, practice days, completed quizzes, daily first-quiz error rate, overall error rate, Demonstrated Mastery, Projected mastery, projected level label, placement-readiness score, and vocabulary coverage by tier. Coverage shows distinct words tested and divides them by the most recent first-presentation result: right or wrong. Presumed-known but untested words do not count as tested.

A separate standings screen is planned. It will read the small local profile summaries rather than scanning all historical attempts. These standings compare only activity stored in that browser. After Firestore synchronization is added, the same screen reads shared profile summary documents and becomes cross-device.

The persistent user menu provides **Export**, which downloads a formatted JSON diagnostic for only the active profile. The export has its own schema version and includes application version/release date, vocabulary ID/version/count, transparent-cognate counts by tier, onboarding placement, activity data, per-word learning state, daily plans, IndexedDB practice sessions/rounds/attempts, storage health, origin, locale, timezone, and user agent. It excludes the complete vocabulary, unrelated browser data, and every other profile. The learner can attach this file to an email or a support conversation; no data is transmitted automatically.

Initially show:

- First-pass correct answers.
- First-pass accuracy.
- Quizzes completed.
- Distinct vocabulary seen.
- Most recent activity.

Proposed initial ranking is total first-pass correct answers, with first-pass accuracy as the tie-breaker. This rewards continued practice; ranking solely by accuracy would let a learner remain first after completing only one small quiz. This ranking rule is easy to change and should be confirmed after the first users try it.

Follow-up answers do not increase the primary first-pass score, but recovery progress can be displayed as its own positive measure.

Future reports may include estimated level and confidence, category performance, frequently missed words, recent trends, and words due for review.

## 11. Security and privacy posture

The local release stores only display names and learning activity in the browser; it collects no email addresses or other personal information. Anyone with access to that browser profile can inspect or alter its local data.

When Firestore is added, the database should not be entirely unauthenticated:

- Require Firebase Authentication for Firestore access.
- Enable anonymous sign-in.
- Allow only the expected invited-group profile IDs.
- Validate permitted fields, primitive types, string lengths, choice counts, and reasonable numeric bounds in Firestore Security Rules.
- Permit public authenticated reads needed for standings.
- Permit creation of attempts and sessions, but not client deletion of history.
- Restrict profile updates to expected summary and presentation fields.
- Continue to store display names only; do not collect email addresses or other personal information.

These measures reduce accidental damage but do not prevent deliberate fabrication, impersonation, or abuse. If the site attracts unwanted traffic, the next step is permanent login plus profile ownership rules; App Check or stronger server-side validation can follow if warranted.

## 12. Client architecture

The prototype uses semantic HTML, CSS, and native JavaScript modules with no required build step. Current structure:

```text
index.html
styles.css
assets/
  vocabulary.json
  vocabulary-official-v1.json
  vocabulary-official-v1.meta.json
  vocabulary-test-v1.json
  vocabulary-test-v1.meta.json
  VOCABULARY_TEST_ATTRIBUTION.md
src/
  app.js
  activity-storage.js
  assessment.js
  app-version.js
  daily-session.js
  diagnostic-export.js
  indexed-history.js
  learning-storage.js
  onboarding-storage.js
  profile-storage.js
  profiles.js
  questions.js
  quiz-selection.js
  storage-generation.js
  quiz-session.js
  recognition.js
scripts/
  build-test-vocabulary.py
tests/
DESIGN.md
```

The later local phase adds an IndexedDB storage implementation, immutable attempt/session records, continuous level estimation, and standings. The synchronization phase adds `firebase.js`, a Firestore storage implementation, and `firestore.rules`.

Responsibilities:

- `questions.js`: implemented pure question, direction, distractor, and shuffle functions.
- `quiz-session.js`: implemented quiz-round state, scoring, alternating reprise generation, and recovery.
- `assessment.js` and `onboarding-storage.js`: implemented adaptive placement and dataset-scoped persistence.
- `quiz-selection.js`: implemented the standalone frontier/Foundation selection strategy.
- `indexed-history.js`: implemented versioned IndexedDB stores and immutable history records.
- `diagnostic-export.js` and `app-version.js`: implemented active-profile diagnostic export and version metadata.
- `profiles.js`, `recognition.js`, and `profile-storage.js`: implemented honor-system identity flow, including the invited-user registration branch.
- `activity-storage.js`: implemented `localStorage` activity summaries and daily streak calculations.
- `daily-session.js`: implemented daily plan construction, check-in selection, new-word throttling, and review-round slicing.
- `mastery-policy.js`: implemented frontier, audit, repair, same-day retirement, and portable concept projection rules.
- `learning-storage.js`: implemented dataset-scoped word evidence, mastery state, review scheduling, coverage, and daily-session persistence.
- `app.js`: implemented rendering, event wiring, and the three-stage session coordinator.
- Planned modules: IndexedDB storage, continuously revised level estimation, and standings.

The practice-session and scheduling domain is implemented without DOM dependencies and is tested against in-memory storage. The next persistence refactor should formalize a common storage interface so IndexedDB and the later Firestore implementation can satisfy the same contract without changing session behavior.

## 13. Interface principles

- Mobile-first and usable with touch or keyboard.
- One obvious primary action per screen.
- Large choice targets with visible focus states.
- Do not communicate correctness by color alone; use icons and text as well.
- Keep accents and `ñ` intact throughout loading, display, and storage.
- Announce new prompts, quiz progress, and brief answer outcomes for screen readers.
- Avoid decorative animations that delay the next question; respect reduced-motion preferences. The intentional answer-choice reveal pause is controlled by the learner's browser-local Answer delay setting.
- Keep the visual tone cheerful and uncluttered rather than resembling a worksheet.

## 14. Deployment

GitHub Pages hosts the deployed static client at `https://fbaseggio.github.io/tarjetasdeflash/`. It loads vocabulary from relative asset paths, stores compact learning state in `localStorage`, and stores session/round/attempt history in IndexedDB; it does not require Firebase.

The completed initial deployment uses:

1. A GitHub repository with Pages enabled for the chosen branch or workflow.
2. A stable Pages URL so returning browsers retain access to the same origin-scoped data.

The shared-persistence phase additionally requires a Firebase project on the free Spark plan, a registered web application, Firestore, Anonymous Authentication, authorized-domain configuration where required, and deployed Firestore Security Rules.

The workspace is a Git repository connected to `fbaseggio/tarjetasdeflash`; pushes to `main` trigger the Pages deployment workflow.

Human-readable application version and release-date metadata live in `src/app-version.js` and must be updated when an exported-data or storage behavior change needs to be distinguishable in diagnostics. IndexedDB and diagnostic export formats have independent numeric schema versions.

## 15. Testing and acceptance criteria

Question-generation logic should be tested independently from the interface.

Implemented prototype acceptance criteria:

- The active vocabulary loads 1,536 official curriculum entries with Year 1/Year 2 labels, four current application tiers, required fields, unique IDs/prompts, and versioned source/transformation metadata.
- Question generation rejects an asset that cannot produce four distinct displayed choices.
- A ten-question quiz contains ten distinct vocabulary IDs.
- A final short review round can contain fewer than four target words while drawing distractors from the full vocabulary.
- Every question has exactly four distinct displayed choices and one correct answer.
- The correct answer appears in varying slots over repeated generation.
- Each question follows the browser-local Answer delay setting before revealing choices: Off, Short, or Normal.
- Active quiz screens keep a compact last-result breadcrumb that carries forward the same post-answer information; wrong-answer breadcrumbs do not reveal the correct answer, and shortened quiz forms show the full flashcard version without crowding the main line on phones.
- A submitted answer shows a brief text-and-color outcome, disables all choices, advances automatically after a short delay, and cannot be changed; correct answers reveal the full teaching pair only when it differs from the quiz form, while misses never reveal the answer.
- No running score is displayed.
- Review first reverses each missed question, then alternates direction after each miss.
- Each direction preserves its own answer positions and strikes through and disables its preceding wrong selections.
- A repeatedly missed question returns to the end of the review queue until answered correctly.
- A completed quiz round reports one right resolution per target word and all wrong submissions; a daily result aggregates all completed rounds.
- The active profile, onboarding placement, aggregate activity, daily plan, latest first-presentation evidence, and word schedules survive closing and reopening the browser.
- The first completed quiz round of a local calendar day advances the streak and baseline rate once; later rounds update only all-quiz totals and error rate.
- A profile without placement completes a 22-question onboarding assessment with brief feedback before its first daily session.
- Onboarding stores a low-confidence known-through band, learning frontier, per-tier scores, and twenty-two first-attempt word results without changing quiz or streak totals.
- A daily session contains an up-to-ten-word due/audit check-in, up to fifteen adaptive explicit new-word presentations, and all due frontier/repair reviews in rounds of at most ten.
- Learners above Everyday receive structured lower-tier audits; Expanding 2 learners see Foundation every other day, and weak lower-tier evidence increases that tier's audit slots.
- Newly presented words are reviewed later in the same session; the new-word count is reduced by one for each eight due-review backlog items and normally keeps an eight-word floor.
- Clean frontier retrieval begins at three days and advances through 7/14/30/60; misses reset to one day, and same-day or immediate-reprise success does not lengthen the gap.
- Clean Foundation audits go to 60 days, clean Everyday and Expanding 1 audits for higher-frontier learners go to 30 days, and misses require two clean spaced repairs before returning to audit status.
- A word is retired from ordinary selection after its first question that day; a miss may receive one later corrective due-review before retirement.
- Spanish-to-English and English-to-Spanish evidence remain separate; the result screen reports distinct tested words and their latest first-presentation outcome by tier.
- Optional extra-practice rounds draw only unseen or due words and exclude all words already questioned that day.
- Reloading recovers the saved session stage and safely restarts an unfinished quiz round without recording partial clicks.
- Completed onboarding, daily sessions, and extra quizzes offer a concise one-page review grouped by tier or session stage.
- Extra-quiz results offer both another quiz and **Start another full session today**.
- **Start another full session today** preserves the actual local date, creates a distinct session record, and does not add another practice day or streak credit.
- IndexedDB stores practice-session snapshots, quiz-round definitions, and every initial or reprise submission as an immutable attempt with exact question text and choices.
- Failure or absence of IndexedDB does not prevent practice; storage status and the failure message appear in diagnostic exports.
- **Export** downloads only the active profile's versioned diagnostic JSON, including application/vocabulary metadata and both browser storage layers.
- The deployed GitHub Pages site works on current mobile and desktop browsers.

Next local-learning acceptance criteria:

- Immutable attempts and completed quiz rounds can rebuild word progress and summary counters through a repair routine.
- Continuous check-in evidence revises the coarse learner level and increases or decreases confidence.
- Replacing a vocabulary dataset preserves reviewed exact semantic matches and does not attach history to ambiguous senses.
- Local standings agree with completed practice sessions and quiz rounds in that browser.
- Reloading within a quiz round restores its exact generated questions, answer positions, eliminated choices, and completed answers.

Shared-persistence acceptance criteria are added in Phase 2: activity recorded on one device must appear under the same selected profile on another, concurrent activity must not lose summary counts, and shared standings must agree with completed sessions.

## 16. Delivery phases

### Phase 1A — Deployed quiz prototype (complete)

- [x] Static recognition layout for four original profiles, seventeen invited names, and six validated Monty Python names.
- [x] Loading of the 100-entry placeholder vocabulary.
- [x] Random ten-question rounds balanced between five Spanish-to-English and five English-to-Spanish prompts.
- [x] Random distractors and answer positions.
- [x] Brief correctness feedback followed by automatic advancement.
- [x] Round-robin, alternating-direction reprise with direction-specific cumulative answer elimination.
- [x] A final-only score of ten right answers and accumulated wrong submissions.
- [x] Local aggregate activity, first-quiz-of-day measurement, and streak reporting.
- [x] GitHub Pages deployment and automated domain-logic tests.

### Phase 1B — Local learning sessions (in progress)

- [x] A 1,536-entry official curriculum vocabulary with chapter order, Year 1/Year 2 labels, canonical lemmas, merged senses, structured grammar metadata, source metadata, and validation tests.
- [x] One-time 12-core-plus-6-confirmation adaptive onboarding with persisted tentative placement.
- [x] Activation of the larger vocabulary and frontier-weighted quiz selection with Foundation auditing.
- [x] Daily practice sessions composed of check-in, explicit new-word presentation, and due reviews.
- [x] IndexedDB practice-session snapshots, quiz-round definitions, and immutable attempts.
- [x] Active-profile diagnostic JSON export with application, vocabulary, storage, and browser metadata.
- [x] Concise result review for onboarding, daily-session stages, and extra quizzes.
- [x] End-of-practice actions for another quiz or another full same-day session.
- [ ] IndexedDB-backed profiles, learner-level evidence, word progress, and summary counters.
- [x] Per-word, per-direction latest first-presentation progress and frontier 3/7/14/30/60-day scheduling with one-day miss recovery.
- [x] Separate frontier, below-frontier audit, and repair mastery tracks with day-wide retirement.
- [x] Versioned portable per-concept mastery projection included in diagnostics.
- [x] Tier coverage reporting for distinct tested words and latest first-presentation outcomes.
- [x] Repeatable same-day sessions with distinct history identities and one daily streak baseline.
- [x] Initial learner known-through band, learning frontier, and low confidence derived from onboarding first attempts.
- [x] Projected-mastery level label on the result screen and share text.
- [ ] Safe promotion/demotion rules that let projected mastery revise the instructional frontier.
- [ ] Vocabulary import/migration that consumes the portable projection and preserves exact overlapping word/sense history.
- [ ] Multi-day progress views and local standings.
- [x] Stage-level reload recovery with safe restart of an unfinished quiz round.

### Phase 2 — Shared history

- Firebase project and configuration.
- Anonymous authentication.
- Firestore profiles, sessions, attempts, word progress, and summary counters.
- One-time migration of existing browser data.
- Cross-device persistence and standings.
- Firestore Security Rules.

### Phase 3 — Learning improvements

- Editorially refine the first-pass semantic tags and add learner-confusion features.
- Refinement of the spaced-repetition algorithm using observed results.
- Progress and trouble-word reports.
- Validated backup import before accumulated history becomes costly to replace; diagnostic export already exists.

### Phase 4 — Optional maturity

- Permanent user login and profile ownership.
- Vocabulary/deck administration.
- Audio and additional question types.
- Offline support and installation as a progressive web app.

## 17. Open decisions

- Whether a learner must finish or explicitly abandon an in-progress quiz before starting another.
- The final standings ranking and tie-break rules after early user feedback.
- Whether incomplete sessions count as activity but not as completed quizzes.
- The exact testing-vocabulary tier boundaries and how the final user-provided vocabulary maps onto them.
- Whether the session's soft cap is controlled primarily by prompt count, elapsed time, or learner choice.
- Calibration of level-estimation promotion, demotion, and confidence thresholds after early testing.
- Whether repeated full sessions should use the same adaptive new-word policy or a lighter same-day practice mix.

## 18. References

- [Instituto Cervantes Plan Curricular vocabulary inventories](https://cvc.cervantes.es/ensenanza/biblioteca_ele/plan_curricular/indice.htm)
- [`doozan/spanish_data` source compilation](https://github.com/doozan/spanish_data)
- [FrequencyWords Spanish corpus](https://github.com/hermitdave/FrequencyWords)
- [Wiktionary licensing](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)
- [Cloud Firestore pricing](https://firebase.google.com/docs/firestore/pricing)
- [Firebase anonymous authentication for web](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Cloud Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase pricing plans and Cloud Billing](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
