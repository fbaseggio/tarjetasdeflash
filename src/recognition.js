import {
  beginsSelfRegistration,
  getProfileById,
  isCorrectSwallowAnswer,
  resolveProfile,
  resolveSelfRegisteredProfile,
} from "./profiles.js?v=0.24.11";

export function initializeRecognition({
  form,
  swallowForm,
  nameForm,
  nameSelect,
  customNameGroup,
  customNameInput,
  panel,
  title,
  intro,
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
  readSwallowAnswer = (currentForm) => new FormData(currentForm).get("swallow-answer"),
  readName = (currentForm) => {
    const formData = new FormData(currentForm);
    return {
      profileId: formData.get("profile-name"),
      customName: formData.get("custom-name"),
    };
  },
}) {
  function hideCustomName() {
    customNameGroup.hidden = true;
    customNameInput.required = false;
  }

  function showStep(step) {
    form.hidden = step !== "favorites";
    swallowForm.hidden = step !== "swallow";
    nameForm.hidden = step !== "name";
    feedback.textContent = "";

    if (step === "favorites") {
      title.textContent = "First, tell us your favorites.";
      intro.textContent = "We’ll remember you the next time you study on this device.";
    } else if (step === "swallow") {
      title.textContent = "One last identity check.";
      intro.textContent = "What is the air-speed of a swallow?";
    } else {
      title.textContent = "Welcome, traveler.";
      intro.textContent = "What is your name?";
    }
  }

  function showRecognition() {
    form.reset();
    swallowForm.reset();
    nameForm.reset();
    hideCustomName();
    showStep("favorites");
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

    if (beginsSelfRegistration(answers.animal, answers.color)) {
      showStep("swallow");
      swallowForm.querySelector("input")?.focus();
      return;
    }

    if (!profile) {
      feedback.textContent = "We don’t recognize that combination yet. Try again.";
      return;
    }

    activateProfile(profile);
  });

  swallowForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!isCorrectSwallowAnswer(readSwallowAnswer(swallowForm))) {
      feedback.textContent = "We don’t recognize that answer yet. Try again.";
      return;
    }

    showStep("name");
    nameSelect.focus();
  });

  nameSelect.addEventListener("change", () => {
    const usesCustomName = nameSelect.value === "other";
    customNameGroup.hidden = !usesCustomName;
    customNameInput.required = usesCustomName;
    if (usesCustomName) customNameInput.focus();
  });

  nameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const answer = readName(nameForm);
    const profile = resolveSelfRegisteredProfile(answer.profileId, answer.customName);

    if (!profile) {
      feedback.textContent = answer.profileId === "other"
        ? "Enter the full name of a Monty Python member."
        : "Please choose your name from the list.";
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
