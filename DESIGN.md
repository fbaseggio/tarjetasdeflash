# Spanish Flash Cards — Design

## 1. Purpose

Build a small, mobile-friendly Spanish vocabulary quiz for approximately four learners. The first version should be easy to host, understand, and change. It will run as a static website on GitHub Pages and preserve profiles, history, and spaced-repetition progress in the browser. A later phase will add Firebase Cloud Firestore for synchronization and shared standings across devices.

The application should make short practice sessions pleasant, preserve multi-day learning history, schedule useful reviews, and provide friendly standings. Its storage boundary should allow local browser data to be replaced or synchronized with Firestore without rewriting the quiz system.

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

The vocabulary universe is currently the placeholder file [`assets/vocabulary.json`](assets/vocabulary.json), containing 100 entries. Each entry has this shape:

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
- The application validates loaded vocabulary and fails visibly if IDs are duplicated or required fields are missing.
- Question generation must not assume that display text is unique. Distractor choices must be deduplicated by their displayed answer text.

The vocabulary file remains a static application asset in the MVP. Moving vocabulary into Firestore is unnecessary until browser-based editing or dynamic decks are desired.

## 5. Core concepts

The system keeps these concepts separate:

- **Vocabulary item:** durable source content such as `manzana` / `apple`.
- **Question:** one generated prompt, answer, direction, and set of four choices.
- **Quiz session:** an ordered group of questions attempted by one profile.
- **Attempt:** one submitted answer to one question.
- **Word progress:** one profile's scheduling and performance state for one vocabulary item.
- **Profile summary:** repairable aggregate data used to display standings efficiently.

This separation allows the same vocabulary item to appear in different directions and follow-up rounds while retaining an accurate history of what the learner saw.

## 6. Question generation

### 6.1 Initial question type

The MVP uses four-choice multiple choice in both directions. Each ten-question initial pass contains five Spanish-to-English and five English-to-Spanish questions, shuffled into a mixed order. Every vocabulary item has a stable four-choice variant in each direction: exactly one correct answer and three distractors.

### 6.2 Question selection

The selector never repeats a vocabulary item within the same quiz. A normal quiz contains ten questions. If the selected vocabulary universe contains fewer than ten usable items, the quiz length is reduced rather than duplicating questions.

For a profile with no history, selection is random. Once history exists, the initial spaced-repetition strategy chooses questions in this order:

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

## 7. Quiz behavior

### 7.1 Main flow

1. The learner selects a profile.
2. The dashboard shows recent progress and a **Start quiz** action.
3. The generator creates ten unique questions.
4. The learner answers one question at a time.
5. Selecting an answer immediately advances without revealing whether it was correct.
6. After the tenth initial question, missed vocabulary enters a review queue.
7. Review continues until every vocabulary item has been answered correctly.
8. Only then does the result screen show the final right and wrong counts.

The current question number is visible during the initial pass, followed by the number of unresolved review words. Running right and wrong counts are not displayed. A submitted answer cannot be changed, because changes would make attempt history ambiguous.

### 7.2 Scoring

The quiz records every submitted answer. Correctly resolving a vocabulary item contributes one right answer; every incorrect submission contributes one wrong answer. Because the session does not end until all ten items are resolved, the final result is always `10 right` and `N wrong`.

The result screen appears only at completion and offers a new ten-question quiz.

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

## 8. Profiles and identity

The first release supports four profiles stored in the browser. A profile has a stable ID, display name, optional color or avatar marker, and timestamps. On a device without a remembered profile, the learner answers two playful recognition questions using Spanish choices:

| Favorite animal | Favorite color | Profile ID | Display name |
|---|---|---|---|
| Elefante | Azul | `franco` | Franco |
| Panda | Morado | `rebecca` | Rebecca |
| Pingüino | Rojo | `milo` | Milo |
| León | Verde | `gideon` | Gideon |

Other combinations do not identify a known profile and prompt the learner to try again. A successful match stores only the active profile ID in `localStorage`, greets that learner by name on later visits, and skips the questions. A quiet **Change user** action clears the active selection without deleting any profile's learning history.

Each profile's sessions, attempts, and word schedule persist across visits made with the same browser and GitHub Pages origin. Profiles sharing that browser can also have local standings. Clearing site data, using private browsing, changing browsers, changing the site's origin, or moving to another device will not carry this history with them.

When shared persistence is added, Firebase Anonymous Authentication will identify a browser installation while the application profile continues to identify the learner:

- A Firebase anonymous user identifies a browser installation.
- A profile identifies the human whose learning history is being updated.
- Multiple anonymous browser identities may submit activity for the same profile.

This is an honor-system design. Anyone who can open the site can select any profile. A later release can attach each profile to a permanent Firebase login without changing historical profile IDs.

## 9. Persistence

### 9.1 Storage boundary

Quiz logic uses a storage interface rather than calling IndexedDB or Firestore directly. The interface covers profiles, sessions, attempts, per-word progress, summaries, and the current in-progress quiz. This permits the first release to work locally while preserving a path to synchronization.

### 9.2 Initial browser storage

IndexedDB is the source of truth for the first release. It stores:

- Profiles and local summary counters.
- Immutable quiz sessions and answer attempts.
- Per-profile, per-word scheduling state.
- The generated state of an in-progress quiz so a reload does not reshuffle it.

The browser database has an explicit schema version and uses stable profile and vocabulary IDs. Future releases must migrate existing records rather than silently replacing the database.

The current 100-word vocabulary is test content, so export/import is intentionally deferred. It should be added before the vocabulary becomes substantial or the accumulated learner history becomes costly to replace.

### 9.3 Later shared service

Cloud Firestore will become the shared backend when cross-device support is implemented. It can be called directly from the static browser application and is ample for the expected data volume on its free quota.

Firebase configuration values used by the web client are public application identifiers, not secrets. Administrative credentials and service-account keys must never be committed or placed in browser code.

The first synchronization release may use an explicit one-time migration from the browser database. General-purpose export/import is not required for the test vocabulary phase.

### 9.4 Data stores and Firestore collections

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
```

This record is the input to spaced-repetition selection. Follow-up attempts increase practice history but do not advance `consecutiveCorrect` or `intervalDays`.

### 9.5 Writes and consistency

- Create an immutable attempt record for every submitted answer.
- Complete a quiz session only after all its questions are answered.
- Atomically record an attempt and update word progress and summary counters when the storage engine supports transactions.
- Never silently delete historical attempts.
- Store timestamps as absolute UTC instants and display them in the learner's local time zone.
- When Firestore is added, use server timestamps, transactions or atomic batches, and atomic increments so simultaneous activity from two devices is not lost.

If a summary update fails after an attempt is preserved, a repair routine can recalculate summaries from the immutable records.

## 10. Standings and reporting

The standings screen reads the four small local profile summaries rather than scanning all historical attempts. These standings compare only activity stored in that browser. After Firestore synchronization is added, the same screen reads shared profile summary documents and becomes cross-device.

Initially show:

- First-pass correct answers.
- First-pass accuracy.
- Quizzes completed.
- Distinct vocabulary seen.
- Most recent activity.

Proposed initial ranking is total first-pass correct answers, with first-pass accuracy as the tie-breaker. This rewards continued practice; ranking solely by accuracy would let a learner remain first after completing only one small quiz. This ranking rule is easy to change and should be confirmed after the first users try it.

Follow-up answers do not increase the primary first-pass score, but recovery progress can be displayed as its own positive measure.

Future reports may include category performance, frequently missed words, streaks, recent trends, and words due for review.

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

The MVP uses semantic HTML, CSS, and native JavaScript modules with no required build step. Suggested structure:

```text
index.html
styles.css
assets/
  vocabulary.json
src/
  app.js
  browser-storage.js
  vocabulary.js
  questions.js
  scheduler.js
  quiz.js
  storage.js
  standings.js
DESIGN.md
```

The later synchronization phase adds `firebase.js`, a Firestore storage implementation, and `firestore.rules`.

Responsibilities:

- `vocabulary.js`: load and validate vocabulary.
- `questions.js`: pure selection, distractor, direction, and shuffle functions.
- `scheduler.js`: per-word progress updates, due-date calculation, and review priority.
- `quiz.js`: quiz state, scoring, follow-up generation, and recovery.
- `storage.js`: persistence interface used by quiz code.
- `browser-storage.js`: initial IndexedDB implementation.
- `standings.js`: profile summary display and ranking.
- `app.js`: navigation, rendering, and event wiring.

The quiz domain should depend on the storage interface rather than IndexedDB or Firestore calls directly. A memory implementation supports automated tests, and the later Firestore implementation can satisfy the same contract.

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

GitHub Pages hosts the static client. The first deployed version loads vocabulary from a relative asset path and stores progress locally in IndexedDB; it does not require Firebase.

Initial deployment requires:

1. A GitHub repository with Pages enabled for the chosen branch or workflow.
2. A stable Pages URL so returning browsers retain access to the same origin-scoped data.

The shared-persistence phase additionally requires a Firebase project on the free Spark plan, a registered web application, Firestore, Anonymous Authentication, authorized-domain configuration where required, and deployed Firestore Security Rules.

The repository currently contains project files but is not initialized as a Git repository in this workspace. Repository initialization, remote configuration, and publication are separate implementation steps.

## 15. Testing and acceptance criteria

Question-generation logic should be tested independently from the interface.

Local-release acceptance criteria:

- The vocabulary asset loads and validates all 100 current entries.
- A ten-question quiz contains ten distinct vocabulary IDs.
- Every question has exactly four distinct displayed choices and one correct answer.
- The correct answer appears in varying slots over repeated generation.
- A submitted answer advances immediately without outcome feedback and cannot be changed.
- No running score is displayed.
- Review first reverses each missed question, then alternates direction after each miss.
- Each direction preserves its own answer positions and strikes through and disables its preceding wrong selections.
- A repeatedly missed question returns to the end of the review queue until answered correctly.
- The final score always reports ten right answers and the total number of wrong submissions.
- Profiles, attempts, summaries, and word schedules survive closing and reopening the browser.
- Due words are prioritized on a later day according to the documented intervals.
- A wrong first-pass answer resets its schedule, while an immediate follow-up success does not lengthen its interval.
- Local standings agree with completed sessions in that browser.
- A page reload can recover or clearly abandon an in-progress quiz without silently corrupting its results.
- The deployed GitHub Pages site works on current mobile and desktop browsers.

Shared-persistence acceptance criteria are added in Phase 2: activity recorded on one device must appear under the same selected profile on another, concurrent activity must not lose summary counts, and shared standings must agree with completed sessions.

## 16. Delivery phases

### Phase 1 — Local quiz

- Static layout and profile selector.
- Vocabulary loading and validation.
- Random ten-question quizzes balanced between five Spanish-to-English and five English-to-Spanish prompts.
- Random distractors and answer positions.
- Automatic advancement without correctness feedback.
- Round-robin, alternating-direction review with direction-specific cumulative answer elimination.
- A final-only score of ten right answers and the accumulated wrong submissions.
- IndexedDB profiles, sessions, attempts, and summary counters.
- Per-word progress and the initial 1/3/7/14/30-day review schedule.
- Multi-day progress views and local standings.
- Reload recovery for an in-progress quiz.

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
- Export/import before replacing or substantially expanding the test vocabulary.

### Phase 4 — Optional maturity

- Permanent user login and profile ownership.
- Vocabulary/deck administration.
- Audio and additional question types.
- Offline support and installation as a progressive web app.

## 17. Open decisions

- The four initial profile names and optional colors or avatars.
- Whether a learner must finish or explicitly abandon an in-progress quiz before starting another.
- The final standings ranking and tie-break rules after early user feedback.
- Whether incomplete sessions count as activity but not as completed quizzes.

## 18. References

- [Cloud Firestore pricing](https://firebase.google.com/docs/firestore/pricing)
- [Firebase anonymous authentication for web](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Cloud Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase pricing plans and Cloud Billing](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
