import { buildQuizFromAnswers } from "./questions.js?v=0.25.2";
import { createQuizSession } from "./quiz-session.js?v=0.25.2";
import { localDateKey } from "./learning-storage.js?v=0.25.2";
import {
  createFocusStorage, courseProgress, planFocusLesson, recordFocusAttempt, finishFocusLesson,
  focusWordStatus, setFocusWordPriority,
} from "./focus-course.js?v=0.25.2";

export function createFocusCourseController({ panel, storage, answerDelay, recordActivity }) {
  const persistence = createFocusStorage(storage);
  let profile = null;
  let course = null;
  let state = null;
  let timer = null;
  let active = false;
  const today = () => localDateKey(new Date());
  const currentLesson = () => state.lessons.at(-1);

  function clearTimer() {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  }

  function element(tag, text = "", className = "") {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function run(action) {
    try { action(); } catch (error) { showError(error); }
  }

  function later(action, delay) {
    clearTimer();
    timer = window.setTimeout(() => {
      timer = null;
      if (active && !panel.hidden) run(action);
    }, delay);
  }

  function button(text, action, secondary = false) {
    const node = element("button", text, secondary ? "secondary-button" : "next-button");
    node.type = "button";
    node.addEventListener("click", () => run(action));
    return node;
  }

  function screen(title, eyebrow = course.title) {
    clearTimer();
    panel.replaceChildren(element("div", eyebrow, "eyebrow"), element("h1", title));
    panel.hidden = false;
  }

  function showError(error) {
    clearTimer();
    console.error(error);
    panel.replaceChildren(element("h1", "Your lesson needs attention."),
      element("p", `${error.message} Reload to resume from the last saved answer.`, "feedback error"),
      button("Reload saved lesson", () => activate(profile, course)));
    panel.hidden = false;
  }

  function update(change) {
    const saved = persistence.read(profile.id);
    if ((saved.revision ?? 0) !== (state.revision ?? 0)) {
      throw new Error("This profile was updated in another tab.");
    }
    change(saved);
    saved.revision = (saved.revision ?? 0) + 1;
    persistence.save(profile.id, saved);
    state = saved;
  }

  function progressText() {
    const progress = courseProgress(state, course.entries);
    return `${progress.tested} / ${progress.total} words tested · ${progress.mastered} with two or more review successes${progress.known ? ` · ${progress.known} marked “I know this”` : ""}`;
  }

  function showHome() {
    const unfinished = currentLesson()?.status === "in-progress" ? currentLesson() : null;
    const plan = unfinished ?? planFocusLesson(course.entries, state, today());
    screen(unfinished ? "Continue your quiz." : "Your next quiz.");
    panel.append(element("p", progressText(), "results-intro"));
    if (plan.questionIds.length === 0) {
      panel.append(element("p", "No eligible words right now. Missed words return on the next calendar day; words marked “I know this” stay excluded."));
      panel.append(button("Check for available reviews", showHome));
    } else {
      const description = `${plan.questionIds.length} words: ${plan.newWordIds.length} not yet tested, ${plan.retryIds.length} missed-word reviews, ${plan.firstCorrectIds.length + plan.recoveredIds.length} scheduled reviews, and ${plan.fillIds?.length ?? 0} extra practice words.`;
      panel.append(element("p", description, "onboarding-copy"),
        element("p", "Straight to the quiz—no teaching cards. Extra practice favors words with fewer correct first answers, with random choices among ties. Immediate retries don’t add to that count.", "onboarding-note"));
      if (plan.questionIds.length < 11) {
        panel.append(element("p", "This set is shorter because the other words are marked known or waiting until tomorrow.", "onboarding-note"));
      }
      panel.append(button(unfinished ? "Resume lesson" : "Begin lesson", startLesson));
    }
    if (currentLesson()?.status === "complete") {
      panel.append(button("Review last lesson", showSummary, true));
    }
  }

  function startLesson() {
    if (currentLesson()?.status !== "in-progress") {
      const plan = planFocusLesson(course.entries, state, today());
      if (!plan.questionIds.length) { showHome(); return; }
      update((draft) => draft.lessons.push(plan));
    }
    resumeLesson();
  }

  function resumeLesson() {
    // Preserve saved lessons and answers, but bypass an old teaching-card stage.
    if (currentLesson().stage === "new-words") {
      update((draft) => { draft.lessons.at(-1).stage = "quiz"; });
    }
    showQuestion();
  }

  function restoredQuiz() {
    const lesson = currentLesson();
    const quiz = createQuizSession(lesson.definitions);
    for (const attempt of lesson.attempts) {
      const before = quiz.getState();
      if (before.question?.vocabularyId !== attempt.vocabularyId
          || before.phase !== attempt.phase || before.direction !== attempt.direction) {
        throw new Error("The saved question history does not match this lesson.");
      }
      quiz.submitAnswer(attempt.selectedAnswer);
      quiz.advance();
    }
    return quiz;
  }

  function feedback(attempt) {
    if (!attempt) return null;
    const box = element("div", "", `last-result ${attempt.correct ? "correct" : "incorrect"}`);
    box.setAttribute("aria-live", "polite");
    box.append(element("span", `${attempt.correct ? "✓ Correct" : "✕ Not quite"}: ${attempt.prompt} → ${attempt.selectedAnswer}`, "last-result-main"));
    if (attempt.correct && attempt.teaching) {
      box.append(element("span", `▣ ${attempt.teaching}`, "last-result-teaching"));
    }
    if (attempt.reminder) {
      box.append(element("span", `Last time you answered “${attempt.reminder.selectedAnswer}” for “${attempt.reminder.prompt}”.`, "last-result-reminder"));
    }
    return box;
  }

  function showQuestion() {
    if (!currentLesson().definitions) {
      const ids = new Set(currentLesson().questionIds);
      const definitions = buildQuizFromAnswers(course.entries, course.entries.filter((entry) => ids.has(entry.id)));
      update((draft) => { draft.lessons.at(-1).definitions = definitions; });
    }
    const quiz = restoredQuiz();
    const current = quiz.getState();
    if (current.phase === "complete") { finishLesson(); return; }
    const question = current.question;
    const direction = current.direction === "spanish-to-english" ? "Spanish → English" : "English → Spanish";
    screen(direction === "Spanish → English" ? "Choose the English translation." : "Choose the Spanish translation.", direction);
    panel.append(element("p", current.phase === "main"
      ? `Question ${current.mainPosition} of ${current.totalQuestions}`
      : `Retry practice · ${current.reviewRemaining} remaining`, "quiz-progress"));
    const lastFeedback = feedback(currentLesson().attempts.at(-1));
    if (lastFeedback) panel.append(lastFeedback);
    const card = element("div", question.prompt, "word-card");
    card.lang = question.promptLanguage;
    const choices = element("div", "", "choices");
    choices.setAttribute("aria-label", "Answer choices");
    choices.setAttribute("aria-busy", "true");
    choices.append(element("p", "Take a moment to recall…", "choice-delay"));
    panel.append(card, choices);
    const reveal = () => {
      choices.replaceChildren();
      choices.removeAttribute("aria-busy");
      question.choices.forEach((answer) => {
        const choice = button(answer, () => {
          const result = quiz.submitAnswer(answer);
          const attempt = {
            vocabularyId: question.vocabularyId, phase: current.phase,
            direction: current.direction, prompt: question.prompt,
            correctAnswer: question.correctAnswer, selectedAnswer: answer,
            correct: result.correct, date: today(), answeredAt: new Date().toISOString(),
            teaching: result.correct && question.hasTeachingVariant
              ? `${question.teachingSpanish} ↔ ${question.teachingEnglish}` : null,
            reminder: result.repriseReminder,
          };
          update((draft) => recordFocusAttempt(draft, draft.lessons.at(-1), attempt));
          choices.querySelectorAll("button").forEach((node) => { node.disabled = true; });
          choice.classList.add(result.correct ? "correct" : "incorrect");
          if (lastFeedback) lastFeedback.remove();
          card.before(feedback(attempt));
          later(showQuestion, result.repriseReminder ? 2000 : question.hasTeachingVariant && result.correct ? 1400 : 850);
        });
        choice.className = "choice";
        choice.lang = question.answerLanguage;
        if (current.knownWrongAnswers.includes(answer)) {
          choice.disabled = true;
          choice.classList.add("eliminated");
        }
        choices.append(choice);
      });
    };
    const delay = answerDelay();
    if (delay === 0) reveal();
    else later(reveal, delay);
  }

  function finishLesson() {
    update((draft) => finishFocusLesson(draft, draft.lessons.at(-1), new Date().toISOString()));
    creditActivity();
    screen("Lesson complete.");
    const lastFeedback = feedback(currentLesson().attempts.at(-1));
    if (lastFeedback) panel.append(lastFeedback);
    panel.append(element("p", "Every question in this lesson is resolved."), button("View summary", showSummary));
  }

  function creditActivity() {
    const lesson = currentLesson();
    if (lesson?.status === "complete") {
      recordActivity(profile.id, {
        correctCount: lesson.correctCount,
        wrongCount: lesson.wrongCount,
        completionId: `${profile.id}:${lesson.id}`,
      }, new Date(lesson.completedAt));
    }
  }

  function showSummary(reviewOpen = false, focusWordId = null) {
    const lesson = currentLesson();
    const firstAnswers = Object.values(lesson.firstAnswers);
    const firstRight = firstAnswers.filter((attempt) => attempt.correct).length;
    const progress = courseProgress(state, course.entries);
    screen("¡Buen trabajo!", `Lesson ${lesson.number} complete`);
    panel.append(element("p", `${firstRight} / ${firstAnswers.length} correct on first answers · ${lesson.wrongCount} wrong submissions`, "results-intro"),
      element("p", progressText()),
      element("p", `${progress.needsReview} needing review. Keep practicing as often as you like.`, "onboarding-note"));
    const next = planFocusLesson(course.entries, state, today());
    panel.append(button(next.questionIds.length ? "Next lesson" : "See course progress", showHome));
    const details = element("details");
    details.open = reviewOpen;
    details.append(element("summary", "Review results"));
    details.append(element("p", "These choices only affect your future reviews, not your score. “Review this” starts a fresh priority review cycle, available from tomorrow. Ordinary words remain available for extra practice even after two successes.", "onboarding-note"));
    const list = element("ul", "", "review-items");
    let focusTarget = null;
    firstAnswers.forEach((attempt) => {
      const entry = course.entries.find((entry) => entry.id === attempt.vocabularyId);
      const word = state.words[entry.id];
      const status = focusWordStatus(word);
      const line = element("li", "", "focus-review-item");
      line.append(element("strong", `${entry.spanish} — ${entry.english}`),
        element("span", `${attempt.correct ? "First answer correct" : "First answer missed"} · ${word.successes} correct first answers${word.reviewStartSuccesses !== undefined ? ` · ${status.successes} in this review cycle` : ""}${status.known ? " · Marked as known — no more questions" : ""}`, "review-answer"));
      if (word.manualPriority === "review") {
        line.append(element("span", `Review requested · available from ${status.eligibleDate}`, "review-answer"));
      }
      const controls = element("div", "", "focus-word-controls");
      const changePriority = (priority) => {
        update((draft) => setFocusWordPriority(draft, entry.id, priority, today()));
        showSummary(true, entry.id);
      };
      const knownButton = button("I know this", () => changePriority("known"), true);
      knownButton.setAttribute("aria-label", `I know this: ${entry.spanish}`);
      knownButton.setAttribute("aria-pressed", String(status.known));
      knownButton.disabled = status.known;
      const reviewButton = button("Review this", () => changePriority("review"), true);
      reviewButton.setAttribute("aria-label", `Review this: ${entry.spanish}`);
      reviewButton.setAttribute("aria-pressed", String(word.manualPriority === "review"));
      reviewButton.disabled = word.manualPriority === "review";
      controls.append(knownButton, reviewButton);
      if (word.manualPriority || word.reviewStartSuccesses !== undefined) {
        controls.append(button("Use quiz results", () => changePriority("normal"), true));
      }
      line.append(controls);
      if (entry.id === focusWordId) {
        line.tabIndex = -1;
        focusTarget = line;
      }
      list.append(line);
    });
    details.append(list);
    panel.append(details);
    // Keep keyboard users on the edited row without jumping on a phone.
    focusTarget?.focus({ preventScroll: true });
  }

  function activate(nextProfile, nextCourse) {
    clearTimer();
    active = true;
    profile = nextProfile;
    course = nextCourse;
    run(() => {
      state = persistence.read(profile.id);
      creditActivity();
      showHome();
    });
  }

  function deactivate() { active = false; clearTimer(); }
  return Object.freeze({ activate, deactivate, getExport: (profileId) => persistence.read(profileId) });
}
