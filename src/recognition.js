import { getProfileById, resolveProfile } from "./profiles.js?v=0.10.1";

export function initializeRecognition({
  form,
  panel,
  feedback,
  quizPanel,
  userMenu,
  greeting,
  changeUserButton,
  storage,
  onRecognized,
  additionalPanels = [],
  readAnswers = (currentForm) => {
    const formData = new FormData(currentForm);
    return {
      animal: formData.get("animal"),
      color: formData.get("color"),
    };
  },
}) {
  function showRecognition() {
    form.reset();
    feedback.textContent = "";
    panel.hidden = false;
    quizPanel.hidden = true;
    additionalPanels.forEach((additionalPanel) => {
      additionalPanel.hidden = true;
    });
    userMenu.hidden = true;
  }

  function activateProfile(profile, persist = true) {
    if (persist) {
      storage.setActiveProfileId(profile.id);
    }

    greeting.textContent = `¡Hola, ${profile.displayName}!`;
    panel.hidden = true;
    quizPanel.hidden = false;
    additionalPanels.forEach((additionalPanel) => {
      additionalPanel.hidden = true;
    });
    userMenu.hidden = false;
    onRecognized(profile);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const answers = readAnswers(form);
    const profile = resolveProfile(answers.animal, answers.color);

    if (!profile) {
      feedback.textContent = "We don’t recognize that combination yet. Try again.";
      return;
    }

    activateProfile(profile);
  });

  changeUserButton.addEventListener("click", () => {
    storage.clearActiveProfileId();
    showRecognition();
    form.querySelector("input")?.focus();
  });

  const savedProfileId = storage.getActiveProfileId();
  const savedProfile = savedProfileId ? getProfileById(savedProfileId) : null;

  if (savedProfile) {
    activateProfile(savedProfile, false);
  } else {
    storage.clearActiveProfileId();
    showRecognition();
  }
}
