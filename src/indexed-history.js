const DATABASE_NAME = "tarjetas-learning";
const DATABASE_VERSION = 1;
const STORE_NAMES = Object.freeze(["practiceSessions", "quizRounds", "attempts"]);

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
  });
}

function createStores(database) {
  if (!database.objectStoreNames.contains("practiceSessions")) {
    const sessions = database.createObjectStore("practiceSessions", { keyPath: "id" });
    sessions.createIndex("profileId", "profileId", { unique: false });
    sessions.createIndex("effectiveDate", "effectiveDate", { unique: false });
  }
  if (!database.objectStoreNames.contains("quizRounds")) {
    const rounds = database.createObjectStore("quizRounds", { keyPath: "id" });
    rounds.createIndex("profileId", "profileId", { unique: false });
    rounds.createIndex("practiceSessionId", "practiceSessionId", { unique: false });
  }
  if (!database.objectStoreNames.contains("attempts")) {
    const attempts = database.createObjectStore("attempts", { keyPath: "id" });
    attempts.createIndex("profileId", "profileId", { unique: false });
    attempts.createIndex("quizRoundId", "quizRoundId", { unique: false });
    attempts.createIndex("practiceSessionId", "practiceSessionId", { unique: false });
    attempts.createIndex("vocabularyId", "vocabularyId", { unique: false });
  }
}

export function createRecordId(prefix, cryptoObject = globalThis.crypto) {
  const suffix = typeof cryptoObject?.randomUUID === "function"
    ? cryptoObject.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export function practiceSessionRecord(profileId, session, updatedAt = new Date().toISOString()) {
  return {
    id: `${profileId}:${session.date}`,
    profileId,
    effectiveDate: session.date,
    simulated: Boolean(session.simulated),
    status: session.status,
    currentStage: session.stage,
    checkInWordIds: [...session.checkInIds],
    newWordIds: [...session.newWordIds],
    presentedWordIds: [...(session.presentedWordIds ?? [])],
    reviewWordIds: [...session.reviewIds],
    newWordIndex: session.newWordIndex,
    reviewCursor: session.reviewCursor,
    quizRoundCount: session.quizRounds,
    correctCount: session.correctCount,
    wrongCount: session.wrongCount,
    streakCredited: Boolean(session.streakCredited),
    completedAt: session.completedAt ?? null,
    updatedAt,
  };
}

export function quizRoundRecord({
  id,
  profileId,
  practiceSessionId,
  stage,
  definitions,
  startedAt,
}) {
  return {
    id,
    profileId,
    practiceSessionId,
    stage,
    status: "in-progress",
    requestedQuestionCount: definitions.length,
    actualQuestionCount: definitions.length,
    questionDefinitions: definitions,
    correctCount: 0,
    wrongCount: 0,
    startedAt,
    completedAt: null,
  };
}

export function createIndexedHistory(indexedDbFactory, now = () => new Date()) {
  let state = indexedDbFactory ? "idle" : "unavailable";
  let lastError = indexedDbFactory ? null : "IndexedDB is not available in this browser.";
  let databasePromise = null;
  let writeChain = Promise.resolve();

  function openDatabase() {
    if (!indexedDbFactory) {
      return Promise.reject(new Error(lastError));
    }
    if (!databasePromise) {
      state = "opening";
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDbFactory.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => createStores(request.result);
        request.onsuccess = () => {
          state = "ready";
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        };
        request.onerror = () => reject(request.error ?? new Error("IndexedDB could not be opened."));
        request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked by another tab."));
      }).catch((error) => {
        state = "error";
        lastError = error.message;
        throw error;
      });
    }
    return databasePromise;
  }

  async function writeRecord(storeName, value, method = "put") {
    try {
      const database = await openDatabase();
      const transaction = database.transaction(storeName, "readwrite");
      const completed = transactionComplete(transaction);
      transaction.objectStore(storeName)[method](value);
      await completed;
      return true;
    } catch (error) {
      state = "error";
      lastError = error.message;
      return false;
    }
  }

  async function recordsForProfile(storeName, profileId) {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readonly");
    const completed = transactionComplete(transaction);
    const request = transaction.objectStore(storeName).index("profileId").getAll(profileId);
    const records = await requestResult(request);
    await completed;
    return records;
  }

  function enqueueWrite(storeName, value, method = "put") {
    const operation = writeChain.then(() => writeRecord(storeName, value, method));
    writeChain = operation.then(() => undefined);
    return operation;
  }

  async function getProfileHistory(profileId) {
    try {
      await writeChain;
      const [practiceSessions, quizRounds, attempts] = await Promise.all(
        STORE_NAMES.map((storeName) => recordsForProfile(storeName, profileId)),
      );
      practiceSessions.sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
      quizRounds.sort((left, right) => left.startedAt.localeCompare(right.startedAt));
      attempts.sort((left, right) => (
        left.answeredAt.localeCompare(right.answeredAt)
        || left.attemptIndex - right.attemptIndex
      ));
      return { practiceSessions, quizRounds, attempts };
    } catch (error) {
      state = "error";
      lastError = error.message;
      return { practiceSessions: [], quizRounds: [], attempts: [] };
    }
  }

  function getStatus() {
    return Object.freeze({
      databaseName: DATABASE_NAME,
      schemaVersion: DATABASE_VERSION,
      state,
      available: Boolean(indexedDbFactory),
      lastError,
    });
  }

  return Object.freeze({
    createId: createRecordId,
    nowIso: () => now().toISOString(),
    savePracticeSession: (record) => enqueueWrite("practiceSessions", record),
    saveQuizRound: (record) => enqueueWrite("quizRounds", record),
    saveAttempt: (record) => enqueueWrite("attempts", record, "add"),
    getProfileHistory,
    getStatus,
  });
}
