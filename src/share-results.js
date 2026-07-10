export const PUBLIC_APP_URL = "https://fbaseggio.github.io/tarjetasdeflash/";
export const SHARE_CARD_WIDTH = 1200;
export const SHARE_CARD_HEIGHT = 630;

export function isFirstSessionOfDay(session) {
  return Boolean(session?.date)
    && !session.repeat
    && (session.sessionKey ?? session.date) === session.date;
}

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function safeCount(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildSessionSharePayload({
  displayName,
  distinctWords,
  newWords,
  retries,
  streak,
  mastery = null,
  url = PUBLIC_APP_URL,
}) {
  const name = String(displayName ?? "A learner").trim() || "A learner";
  const masteryStats = {
    demonstrated: safeCount(mastery?.demonstrated),
    demonstratedToday: safeCount(mastery?.demonstratedToday),
    total: safeCount(mastery?.total),
    projectedPercent: safeCount(mastery?.projectedPercent),
    estimatedLevelLabel: String(mastery?.estimatedLevelLabel ?? "").trim(),
  };
  const card = Object.freeze({
    displayName: name,
    distinctWords: safeCount(distinctWords),
    newWords: safeCount(newWords),
    retries: safeCount(retries),
    streak: safeCount(streak),
    mastery: Object.freeze(masteryStats),
  });
  const masteryText = card.mastery.total > 0
    ? `Mastery ${card.mastery.demonstrated}/${card.mastery.total} (+${card.mastery.demonstratedToday})`
    : "Mastery starting soon";
  const projectedText = card.mastery.projectedPercent > 0
    ? `Projected ${card.mastery.projectedPercent}%`
    : "Projected still learning";
  const levelText = card.mastery.estimatedLevelLabel
    ? `Level ${card.mastery.estimatedLevelLabel}`
    : null;
  const stats = [
    masteryText,
    projectedText,
    levelText,
    countLabel(card.retries, "retry", "retries"),
  ].filter(Boolean).join(" · ");
  const text = `🇪🇸 ${name} practiced Spanish today.\n${stats}\nTry it: ${url}`;
  return Object.freeze({
    title: `${name}’s Spanish practice`,
    text,
    url,
    clipboardText: text,
    card,
  });
}

export function buildShareCardSvg(payload) {
  const card = payload.card;
  const name = escapeXml(card.displayName.slice(0, 32));
  const urlLabel = escapeXml(payload.url.replace(/^https?:\/\//, ""));
  const tiles = [
    { value: card.distinctWords, label: "WORDS", fill: "#6156D9", color: "#FFFFFF" },
    { value: card.newWords, label: "NEW", fill: "#F2C14E", color: "#241F3B" },
    { value: `+${card.mastery.demonstratedToday}`, label: "MASTERY", fill: "#F5D0CF", color: "#A53B37" },
    { value: card.streak, label: "DAY STREAK", fill: "#BDE8D5", color: "#176846" },
  ];
  const tileMarkup = tiles.map((tile, index) => {
    const x = 70 + index * 275;
    return `<g transform="translate(${x} 285)">
      <rect width="250" height="190" rx="24" fill="${tile.fill}"/>
      <text x="125" y="105" text-anchor="middle" fill="${tile.color}" font-family="Arial, sans-serif" font-size="72" font-weight="800">${tile.value}</text>
      <text x="125" y="150" text-anchor="middle" fill="${tile.color}" font-family="Arial, sans-serif" font-size="22" font-weight="800" letter-spacing="2">${tile.label}</text>
    </g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHARE_CARD_WIDTH}" height="${SHARE_CARD_HEIGHT}" viewBox="0 0 ${SHARE_CARD_WIDTH} ${SHARE_CARD_HEIGHT}">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFF7DF"/>
        <stop offset="1" stop-color="#F2EEF9"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#background)"/>
    <rect x="42" y="42" width="1116" height="546" rx="38" fill="#FFFDF8" stroke="#E4DED2" stroke-width="3"/>
    <circle cx="105" cy="105" r="34" fill="#6156D9"/>
    <text x="105" y="119" text-anchor="middle" fill="#FFFFFF" font-family="Georgia, serif" font-size="38" font-weight="700">¡!</text>
    <text x="158" y="99" fill="#6156D9" font-family="Arial, sans-serif" font-size="22" font-weight="800" letter-spacing="3">TARJETAS DE FLASH</text>
    <text x="70" y="205" fill="#211D38" font-family="Georgia, serif" font-size="58" font-weight="700">${name} practiced Spanish today</text>
    <text x="72" y="247" fill="#6F6A7B" font-family="Arial, sans-serif" font-size="24">One session. A little stronger.</text>
    ${tileMarkup}
    <text x="600" y="545" text-anchor="middle" fill="#6F6A7B" font-family="Arial, sans-serif" font-size="21">${urlLabel}</text>
  </svg>`;
}

function imageLoaded(image, source) {
  return new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("The share card could not be rendered."));
    image.src = source;
  });
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The share card could not be encoded."));
    }, "image/png");
  });
}

export async function createShareImageFile(
  documentObject,
  urlObject,
  FileConstructor,
  payload,
) {
  const svgBlob = new Blob([buildShareCardSvg(payload)], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = urlObject.createObjectURL(svgBlob);
  try {
    const image = documentObject.createElement("img");
    await imageLoaded(image, objectUrl);
    const canvas = documentObject.createElement("canvas");
    canvas.width = SHARE_CARD_WIDTH;
    canvas.height = SHARE_CARD_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in this browser.");
    context.drawImage(image, 0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);
    const pngBlob = await canvasBlob(canvas);
    return new FileConstructor([pngBlob], "tarjetas-session-results.png", {
      type: "image/png",
      lastModified: Date.now(),
    });
  } finally {
    urlObject.revokeObjectURL(objectUrl);
  }
}

export async function shareSessionResults(navigatorObject, payload, imageFile = null) {
  if (typeof navigatorObject?.share === "function") {
    try {
      const shareData = {
        title: payload.title,
        text: payload.text,
      };
      let sharesImage = false;
      if (imageFile && typeof navigatorObject.canShare === "function") {
        try {
          sharesImage = navigatorObject.canShare({ files: [imageFile] });
        } catch {
          sharesImage = false;
        }
      }
      if (sharesImage) shareData.files = [imageFile];
      await navigatorObject.share(shareData);
      return sharesImage ? "shared-image" : "shared";
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
