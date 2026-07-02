# Spanish Flash Cards — Design

## 1. Purpose

Build a small, mobile-friendly Spanish vocabulary learning application for approximately four learners. The first version should be easy to host, understand, and change. It runs as a static website on GitHub Pages. The current prototype preserves the selected profile and activity summaries in the browser; later local phases add per-word history and spaced-repetition scheduling. A still later phase adds Firebase Cloud Firestore for synchronization and shared standings across devices.

The application should make short practice sessions pleasant, preserve multi-day learning history, schedule useful reviews, and provide friendly standings. Its storage boundary should allow local browser data to be replaced or synchronized with Firestore without rewriting the quiz system.

## Implementation status — July 2026

### Implemented and deployed

- Static GitHub Pages application at `https://fbaseggio.github.io/tarjetasdeflash/` with no build step.
- Four playful, honor-system profiles with per-browser recognition, greeting, and change-user behavior.
- A 100-entry placeholder vocabulary asset.
- A separate, versioned 1,500-entry CC BY-SA testing vocabulary with three 500-entry bands, source attribution, retained original IDs, a reproducible build script, and validation tests. It is not yet active in the quiz.
- Random ten-word quiz rounds, balanced between five Spanish-to-English and five English-to-Spanish prompts.
- Four randomized choices with stable answer positions for both direction variants.
- Silent automatic advancement: no correctness feedback appears after a submission.
- Round-robin reprise of missed words, first in the opposite direction and then alternating directions, with prior wrong choices struck through and disabled in the applicable direction.
- Final-only scoring of ten resolved words and all wrong submissions.
- Per-profile `localStorage` summaries for membership days, practiced days, current streak, completed quizzes, first-quiz-of-day error rate, and all-quiz error rate.
- Automated tests for question generation, quiz/reprise behavior, profiles, recognition, and activity summaries.

### Next local-learning work

- Deliberate activation of the 1,500-entry testing vocabulary and migration support for the eventual user-provided vocabulary.
- A daily **practice session** containing a check-in, explicit presentation of new words, and due-review rounds.
- Persistent per-word attempts, direction-specific knowledge, estimated learner level, and spaced-repetition due dates.
- Vocabulary-aware selection instead of entirely random selection.
- Reload recovery, progress reporting, and local standings.

### Later work

- Firebase synchronization and shared cross-device history and standings.
- Additional question types, richer content, and authentication if needed.

## 2. Goals

- Present quick Spanish vocabulary quizzes with clear prompts and uninterrupted progression.
- Support approximately four named learner profiles in one browser initially.
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
- Export/import while the current 100-word vocabulary is only test content.
- Anti-cheating controls or high-stakes scoring.

## 4. Vocabulary universe

The active vocabulary universe is currently the placeholder file [`assets/vocabulary.json`](assets/vocabulary.json), containing 100 entries. A separate 1,500-entry CC BY-SA testing set now exists at [`assets/vocabulary-test-v1.json`](assets/vocabulary-test-v1.json), with metadata and attribution alongside it. It remains inactive until per-word persistence and migration behavior are ready. Each active entry has this shape:

```json
{
  "id": "manzana",
  "spanish": "manzana",
  "english": "apple",
  "category": "food-and-drink"
}
```

Requirements:

- `id` is stable and unique. Historical records refer to this ID, so changing display text must not change the ID.
- `spanish` and `english` are the answer text displayed to learners.
- `category` supports future filtering and better distractor selection.
- The current generator checks that enough distinct choices can be formed and fails visibly when vocabulary cannot be loaded. Full schema and duplicate-ID validation remains to be implemented.
- Question generation must not assume that display text is unique. Distractor choices must be deduplicated by their displayed answer text.

The vocabulary file remains a static application asset in the MVP. Moving vocabulary into Firestore is unnecessary until browser-based editing or dynamic decks are desired.

Future vocabulary IDs identify a lemma, part of speech, and intended sense rather than a row or dataset version. Per-word history belongs to the learner, not to a particular vocabulary file. When the final vocabulary arrives, exact semantic matches retain their history and schedule; probable matches require review; ambiguous or changed senses start fresh; removed entries are archived rather than silently deleted. This allows evidence for durable words such as `gato`, `perro`, `rojo`, and `uno` to survive a dataset replacement.

The larger testing data carries a dataset version and source metadata. Its attribution and CC BY-SA licensing are documented separately from application code. It uses English Wiktionary lexical data and the FrequencyWords corpus through the CC-licensed `doozan/spanish_data` compilation, with automated filtering and reviewed learner-facing gloss overrides.

## 5. Core concepts

The system keeps these concepts separate:

- **Vocabulary item:** durable source content such as `manzana` / `apple`.
- **Question:** one generated prompt, answer, direction, and set of four choices.
- **Practice session:** one day's coherent learning flow: a check-in, new-word presentation, and due reviews.
- **Quiz round:** an ordered group of questions, normally ten, within a practice session. The current prototype consists of standalone quiz rounds.
- **Attempt:** one submitted answer to one question.
- **Word progress:** one profile's scheduling and performance state for one vocabulary item.
- **Profile summary:** repairable aggregate data used to display standings efficiently.

This separation allows the same vocabulary item to appear in different directions and follow-up rounds while retaining an accurate history of what the learner saw.

## 6. Question generation

### 6.1 Initial question type

The MVP uses four-choice multiple choice in both directions. Each ten-question initial pass contains five Spanish-to-English and five English-to-Spanish questions, shuffled into a mixed order. Every vocabulary item has a stable four-choice variant in each direction: exactly one correct answer and three distractors.

### 6.2 Question selection

The implemented random selector never repeats a vocabulary item within the same quiz round. A normal round contains ten questions. If the selected vocabulary universe contains fewer than ten usable items, the quiz length is reduced rather than duplicating questions.

The planned history-aware selector chooses questions in this order:

1. Vocabulary whose `nextDueAt` time has passed, oldest due first.
2. Vocabulary the profile has never seen, in random order.
3. Not-yet-due vocabulary, selected randomly only when needed to fill the quiz.

Items in the same priority bucket may be shuffled so quizzes do not feel mechanical. Selection remains an interchangeable strategy so the simple schedule can later be replaced without changing question rendering or scoring.

The first scheduling rule uses consecutive correct first-pass answers to choose an interval of 1, 3, 7, 14, then 30 days. A first-pass mistake resets the consecutive-correct count and makes the word due the following day. Immediate follow-up answers are recorded as recovery practice but do not lengthen the interval; this prevents a correct answer moments after seeing the solution from being treated as durable recall.

### 6.3 Distractor selection

The initial distractor chooser randomly selects three translations from other vocabulary items. It must:

- Exclude the correct vocabulary item.
- Exclude text equal to the correct displayed answer.
- Prevent duplicate displayed choices.
- Stop with a clear error if four distinct choices cannot be formed.

Later strategies may prefer distractors from the same category, grammatically similar words, or commonly confused answers.

### 6.4 Answer position

After the correct answer and three distractors are selected, all four choices are shuffled with Fisher–Yates. The correct answer has no fixed slot and its position should be approximately uniform over many questions.

Generated questions remain stable for the duration of a quiz. Re-rendering a page or selecting an answer must not reshuffle the choices.

## 7. Practice sessions and quiz-round behavior

### 7.1 Main flow

1. The learner selects or resumes a profile.
2. The current prototype immediately generates ten unique questions.
3. The learner answers one question at a time.
4. Selecting an answer immediately advances without revealing whether it was correct.
5. After the tenth initial question, missed vocabulary enters a review queue.
6. Review continues until every vocabulary item has been answered correctly.
7. Only then does the result screen show the final right and wrong counts.

The current question number is visible during the initial pass, followed by the number of unresolved review words. Running right and wrong counts are not displayed. A submitted answer cannot be changed, because changes would make attempt history ambiguous.

### 7.2 Scoring

The quiz records every submitted answer. Correctly resolving a vocabulary item contributes one right answer; every incorrect submission contributes one wrong answer. Because the session does not end until all ten items are resolved, the final result is always `10 right` and `N wrong`.

The result screen appears only at completion and offers a new ten-question quiz round.

Completing a quiz also updates a per-profile practice summary in local browser storage. Calendar dates use the device's local timezone. The first completed quiz on a date is that day's baseline quiz: it adds one practiced day, advances the streak when the preceding practice date was yesterday, and contributes to the daily first-quiz error rate. Later quizzes that day do not change the streak or baseline rate, but do increase the total quiz count and all-quiz error rate.

Both error rates are calculated as wrong submissions divided by all submissions (`wrong / (right + wrong)`). Membership days count calendar days inclusively from the date the profile was first used on this browser. The result screen reports current streak, membership days, practiced days, total quizzes, daily first-quiz error rate, and all-quiz error rate.

### 7.3 Follow-up quizzes

Review is a continuation of the same quiz and contains only unresolved vocabulary from the initial pass.

Default behavior:

- First repeat a missed word in the direction opposite its initial question.
- Alternate direction after every additional wrong review answer.
- Do not reveal whether a submitted answer was correct or incorrect.
- Maintain stable choices and answer positions separately for each direction.
- Display previously selected wrong choices with a strike-through and disable them whenever that direction returns.
- If another wrong answer is selected, record it for that direction and return the opposite-direction variant to the end of the review queue.
- Record each new submission as a separate attempt linked to the same question.

Review proceeds round-robin until all missed vocabulary has been answered correctly.

### 7.4 Planned daily practice session

A **practice session** is the daily learning unit. It contains three stages, each rendered in short quiz rounds rather than one intimidating continuous test:

1. **Check-in:** ten previously encountered words, completed silently with no correctness feedback. The first check-in completed on a local calendar date supplies that day's baseline error rate and streak credit.
2. **New words:** normally about fifteen new entries. Each word is explicitly presented as a Spanish/English pair before later retrieval; genuinely new vocabulary must not rely on a lucky multiple-choice guess as its only exposure.
3. **Due reviews:** all words due under the scheduler, presented in ten-question rounds. Reviews take priority over new words when a backlog develops.

The initial target is fifteen new words per study day, all due reviews, and a soft cap of approximately ninety first-pass prompts or fifteen minutes. If more than roughly sixty reviews are due, the session reduces or suspends new-word introduction. The exact limits remain configuration rather than domain invariants and should be adjusted after observing the four learners.

The current standalone quiz and reprise behavior becomes the interaction primitive used by each stage. A practice session may contain several stored quiz rounds, but streak and first-quiz-of-day reporting are awarded only once per local calendar day.

## 8. Profiles and identity

The first release supports four profiles stored in the browser. A profile has a stable ID, display name, optional color or avatar marker, and timestamps. On a device without a remembered profile, the learner answers two playful recognition questions using Spanish choices:

| Favorite animal | Favorite color | Profile ID | Display name |
|---|---|---|---|
| Elefante | Azul | `franco` | Franco |
| Panda | Morado | `rebecca` | Rebecca |
| Pingüino | Rojo | `milo` | Milo |
| León | Verde | `gideon` | Gideon |

Other combinations do not identify a known profile and prompt the learner to try again. A successful match stores only the active profile ID in `localStorage`, greets that learner by name on later visits, and skips the questions. A quiet **Change user** action clears the active selection without deleting any profile's learning history.

Currently, each profile's aggregate activity summary persists across visits made with the same browser and GitHub Pages origin. Persistent attempts, word schedules, level evidence, and local standings are next-phase work. Clearing site data, using private browsing, changing browsers, changing the site's origin, or moving to another device will not carry local history with the learner.

When shared persistence is added, Firebase Anonymous Authentication will identify a browser installation while the application profile continues to identify the learner:

- A Firebase anonymous user identifies a browser installation.
- A profile identifies the human whose learning history is being updated.
- Multiple anonymous browser identities may submit activity for the same profile.

This is an honor-system design. Anyone who can open the site can select any profile. A later release can attach each profile to a permanent Firebase login without changing historical profile IDs.

### 8.1 Estimated learner level — planned

Each profile will retain a coarse level estimate independently from any vocabulary dataset version:

```text
estimatedTier          // foundation, everyday, or expanding
confidence             // low, medium, or high
receptiveScore         // Spanish-to-English evidence
productiveScore        // English-to-Spanish evidence
wordsAssessed
assessedAt
evidenceDatasetVersion
```

Only first attempts on previously unseen or check-in words contribute primary placement evidence. Immediate reprise answers do not raise the estimate, because they measure recovery rather than durable knowledge. Spanish-to-English and English-to-Spanish evidence remain separate because recognition is generally easier than production, even while both use multiple choice.

The first simple estimator samples words around the learner's presumed tier, waits for at least 30–50 assessed words before claiming medium confidence, considers promotion near 85% first-attempt accuracy, and considers demotion below roughly 60%. These are initial calibration values, not permanent pedagogical rules.

When vocabulary changes, the coarse level estimate remains as a prior. Confidence is rebuilt against the new dataset, while exact semantic word matches retain their full word-level history. Thus a dataset migration neither discards useful knowledge evidence nor treats every approximate match as certain.

## 9. Persistence

### 9.1 Storage boundary

The current quiz domain is independent from activity persistence, but a complete storage interface remains planned. Quiz and session logic will use that interface rather than calling IndexedDB or Firestore directly. It will cover profiles, practice sessions, quiz rounds, attempts, per-word progress, level evidence, summaries, and the current in-progress session. This permits local operation while preserving a path to synchronization.

### 9.2 Initial browser storage

The working prototype stores active-profile selection and compact per-profile activity summaries in `localStorage`. It does not yet persist individual quiz sessions, attempts, in-progress rounds, learner-level evidence, or word schedules. The planned fuller local release uses IndexedDB as its source of truth for:

- Profiles and local summary counters.
- Immutable quiz sessions and answer attempts.
- Per-profile, per-word scheduling state.
- The generated state of an in-progress quiz so a reload does not reshuffle it.

The browser database has an explicit schema version and uses stable profile and vocabulary IDs. Future releases must migrate existing records rather than silently replacing the database.

The current 100-word vocabulary is test content, so general-purpose export/import is intentionally deferred. Stable semantic vocabulary IDs and explicit dataset migration are still required before the vocabulary becomes substantial, because useful word history should survive overlap between the testing and final datasets.

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

#### `quizSessions/{sessionId}`

```text
profileId
parentSessionId        // null for a main quiz
mode                   // "main" or "follow-up"
promptLanguage         // "spanish" or "english"
answerLanguage         // "english" or "spanish"
status                 // "in-progress", "completed", or "abandoned"
requestedQuestionCount
actualQuestionCount
correctCount
startedAt
completedAt
```

#### `attempts/{attemptId}`

```text
sessionId
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
- Complete a quiz-round record only after all its questions are answered, and complete its parent practice session only after the intended stages finish.
- Atomically record an attempt and update word progress and summary counters when the storage engine supports transactions.
- Never silently delete historical attempts.
- Store timestamps as absolute UTC instants and display them in the learner's local time zone.
- When Firestore is added, use server timestamps, transactions or atomic batches, and atomic increments so simultaneous activity from two devices is not lost.

If a summary update fails after an attempt is preserved, a repair routine can recalculate summaries from the immutable records.

## 10. Standings and reporting

The current result screen reports the active learner's streak, membership days, practice days, completed quizzes, daily first-quiz error rate, and overall error rate. A separate standings screen is planned. It will read the four small local profile summaries rather than scanning all historical attempts. These standings compare only activity stored in that browser. After Firestore synchronization is added, the same screen reads shared profile summary documents and becomes cross-device.

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
- Allow only the expected four profile IDs.
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
src/
  app.js
  activity-storage.js
  profile-storage.js
  profiles.js
  questions.js
  quiz-session.js
  recognition.js
DESIGN.md
```

Planned local modules include vocabulary validation, scheduling, per-word/session storage, level estimation, and standings. The later synchronization phase adds `firebase.js`, a Firestore storage implementation, and `firestore.rules`.

Responsibilities:

- `questions.js`: implemented pure question, direction, distractor, and shuffle functions.
- `quiz-session.js`: implemented quiz-round state, scoring, alternating reprise generation, and recovery.
- `profiles.js`, `recognition.js`, and `profile-storage.js`: implemented honor-system identity flow.
- `activity-storage.js`: implemented `localStorage` activity summaries and daily streak calculations.
- `app.js`: implemented rendering and event wiring.
- Planned modules: vocabulary validation, the practice-session coordinator, scheduler, IndexedDB storage, level estimation, and standings.

The future practice-session and scheduling domain should depend on the storage interface rather than IndexedDB or Firestore calls directly. A memory implementation supports automated tests, and the later Firestore implementation can satisfy the same contract.

## 13. Interface principles

- Mobile-first and usable with touch or keyboard.
- One obvious primary action per screen.
- Large choice targets with visible focus states.
- Do not communicate correctness by color alone; use icons and text as well.
- Keep accents and `ñ` intact throughout loading, display, and storage.
- Announce new prompts and quiz progress for screen readers without disclosing answer outcomes.
- Avoid animations that delay the next question; respect reduced-motion preferences.
- Keep the visual tone cheerful and uncluttered rather than resembling a worksheet.

## 14. Deployment

GitHub Pages hosts the deployed static client at `https://fbaseggio.github.io/tarjetasdeflash/`. It loads vocabulary from a relative asset path and currently stores profile selection and aggregate activity in `localStorage`; it does not require Firebase.

The completed initial deployment uses:

1. A GitHub repository with Pages enabled for the chosen branch or workflow.
2. A stable Pages URL so returning browsers retain access to the same origin-scoped data.

The shared-persistence phase additionally requires a Firebase project on the free Spark plan, a registered web application, Firestore, Anonymous Authentication, authorized-domain configuration where required, and deployed Firestore Security Rules.

The workspace is a Git repository connected to `fbaseggio/tarjetasdeflash`; pushes to `main` trigger the Pages deployment workflow.

## 15. Testing and acceptance criteria

Question-generation logic should be tested independently from the interface.

Implemented prototype acceptance criteria:

- The vocabulary asset loads all 100 current entries.
- Question generation rejects an asset that cannot produce four distinct displayed choices; full schema and duplicate-ID validation remains a next-phase criterion.
- A ten-question quiz contains ten distinct vocabulary IDs.
- Every question has exactly four distinct displayed choices and one correct answer.
- The correct answer appears in varying slots over repeated generation.
- A submitted answer advances immediately without outcome feedback and cannot be changed.
- No running score is displayed.
- Review first reverses each missed question, then alternates direction after each miss.
- Each direction preserves its own answer positions and strikes through and disables its preceding wrong selections.
- A repeatedly missed question returns to the end of the review queue until answered correctly.
- The final score always reports ten right answers and the total number of wrong submissions.
- The active profile and aggregate activity summary survive closing and reopening the browser.
- The first completed quiz round of a local calendar day advances the streak and baseline rate once; later rounds update only all-quiz totals and error rate.
- The deployed GitHub Pages site works on current mobile and desktop browsers.

Next local-learning acceptance criteria:

- The larger test vocabulary validates stable semantic IDs, senses, tiers, attribution, and required fields.
- A daily practice session contains a ten-word check-in, explicit new-word presentation, and due-review rounds.
- Profiles, attempts, estimated level evidence, and word schedules survive closing and reopening the browser.
- Due words are prioritized on a later day according to the documented intervals.
- A wrong first attempt shortens its schedule, while an immediate reprise success does not imply durable mastery.
- Spanish-to-English and English-to-Spanish knowledge evidence remain distinguishable.
- Replacing a vocabulary dataset preserves reviewed exact semantic matches and does not attach history to ambiguous senses.
- Local standings agree with completed practice sessions and quiz rounds in that browser.
- A page reload can recover or clearly abandon an in-progress practice session without silently corrupting its results.

Shared-persistence acceptance criteria are added in Phase 2: activity recorded on one device must appear under the same selected profile on another, concurrent activity must not lose summary counts, and shared standings must agree with completed sessions.

## 16. Delivery phases

### Phase 1A — Deployed quiz prototype (complete)

- [x] Static layout and four-profile selector.
- [x] Loading of the 100-entry placeholder vocabulary.
- [x] Random ten-question rounds balanced between five Spanish-to-English and five English-to-Spanish prompts.
- [x] Random distractors and answer positions.
- [x] Automatic advancement without correctness feedback.
- [x] Round-robin, alternating-direction reprise with direction-specific cumulative answer elimination.
- [x] A final-only score of ten right answers and accumulated wrong submissions.
- [x] Local aggregate activity, first-quiz-of-day measurement, and streak reporting.
- [x] GitHub Pages deployment and automated domain-logic tests.

### Phase 1B — Local learning sessions (next)

- [x] Approximately 1,500-entry tiered CC BY-SA testing vocabulary with attribution, retained original IDs, and version metadata.
- [ ] Daily practice sessions composed of check-in, explicit new-word presentation, and due reviews.
- [ ] IndexedDB profiles, quiz rounds, attempts, learner-level evidence, and summary counters.
- [ ] Per-word, per-direction progress and the initial 1/3/7/14/30/60-day review schedule.
- [ ] Estimated learner tier and confidence derived from first-attempt evidence.
- [ ] Vocabulary migration that preserves exact overlapping word/sense history.
- [ ] Multi-day progress views and local standings.
- [ ] Reload recovery for an in-progress practice session.

### Phase 2 — Shared history

- Firebase project and configuration.
- Anonymous authentication.
- Firestore profiles, sessions, attempts, word progress, and summary counters.
- One-time migration of existing browser data.
- Cross-device persistence and standings.
- Firestore Security Rules.

### Phase 3 — Learning improvements

- Category-aware distractors.
- Refinement of the spaced-repetition algorithm using observed results.
- Progress and trouble-word reports.
- General-purpose export/import before accumulated history becomes costly to replace.

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

## 18. References

- [Instituto Cervantes Plan Curricular vocabulary inventories](https://cvc.cervantes.es/ensenanza/biblioteca_ele/plan_curricular/indice.htm)
- [`wordfreq` sources and license](https://github.com/rspeer/wordfreq)
- [Kaikki/Wiktionary machine-readable data and licensing](https://kaikki.org/eswiktionary/index.html)
- [Cloud Firestore pricing](https://firebase.google.com/docs/firestore/pricing)
- [Firebase anonymous authentication for web](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Cloud Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase pricing plans and Cloud Billing](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
