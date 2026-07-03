export const PUBLIC_APP_URL = "https://fbaseggio.github.io/tarjetasdeflash/";

export function isFirstSessionOfDay(session) {
  return Boolean(session?.date)
    && !session.repeat
    && (session.sessionKey ?? session.date) === session.date;
}

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildSessionSharePayload({
  displayName,
  distinctWords,
  newWords,
  retries,
  streak,
  url = PUBLIC_APP_URL,
}) {
  const name = String(displayName ?? "A learner").trim() || "A learner";
  const stats = [
    countLabel(distinctWords, "word") + " practiced",
    countLabel(newWords, "new word"),
    countLabel(retries, "retry", "retries"),
    `${streak}-day streak`,
  ].join(" · ");
  const text = `🇪🇸 ${name} finished today’s Tarjetas de Flash session!\n${stats}`;
  return Object.freeze({
    title: `${name}’s Spanish practice`,
    text,
    url,
    clipboardText: `${text}\nTry it: ${url}`,
  });
}

export async function shareSessionResults(navigatorObject, payload) {
  if (typeof navigatorObject?.share === "function") {
    try {
      await navigatorObject.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "canceled";
      throw error;
    }
  }

  if (typeof navigatorObject?.clipboard?.writeText === "function") {
    await navigatorObject.clipboard.writeText(payload.clipboardText);
    return "copied";
  }

  return "unavailable";
}
