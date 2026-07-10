import { APP_RELEASE_DATE, APP_VERSION, DIAGNOSTIC_EXPORT_VERSION } from "./app-version.js?v=0.23.0";
import {
  cognateTransparencyLevel,
  COGNATE_TRANSPARENCY,
  COGNATE_TRANSPARENCY_THRESHOLDS,
} from "./distractors.js?v=0.23.0";
import { TIER_LABELS, TIER_ORDER } from "./tiers.js?v=0.23.0";

export function buildCognateTransparencySummary(vocabulary) {
  const byTier = TIER_ORDER.map((tier) => {
    const entries = vocabulary.filter((entry) => entry.tier === tier);
    const counts = {
      [COGNATE_TRANSPARENCY.STRONG]: 0,
      [COGNATE_TRANSPARENCY.MODERATE]: 0,
      [COGNATE_TRANSPARENCY.NONE]: 0,
    };
    entries.forEach((entry) => { counts[cognateTransparencyLevel(entry)] += 1; });
    return Object.freeze({
      tier,
      label: TIER_LABELS[tier],
      total: entries.length,
      strong: counts[COGNATE_TRANSPARENCY.STRONG],
      moderate: counts[COGNATE_TRANSPARENCY.MODERATE],
      none: counts[COGNATE_TRANSPARENCY.NONE],
    });
  });

  return Object.freeze({
    thresholds: COGNATE_TRANSPARENCY_THRESHOLDS,
    byTier: Object.freeze(byTier),
  });
}

export function buildDiagnosticExport({
  exportedAt,
  profile,
  dataset,
  onboarding,
  activity,
  learning,
  mastery,
  history,
  storageStatus,
  environment,
  vocabularyTransparency = null,
}) {
  return {
    exportType: "tarjetas-diagnostic",
    exportVersion: DIAGNOSTIC_EXPORT_VERSION,
    exportedAt,
    application: {
      name: "Tarjetas de Flash",
      version: APP_VERSION,
      releaseDate: APP_RELEASE_DATE,
    },
    vocabulary: {
      id: dataset.id,
      version: dataset.version,
      entryCount: dataset.entryCount,
      status: dataset.applicationStatus,
    },
    profile: {
      id: profile.id,
      displayName: profile.displayName,
    },
    onboarding,
    activity,
    learning,
    mastery,
    history,
    diagnostics: {
      storage: storageStatus,
      environment,
      vocabularyTransparency,
    },
  };
}

export function diagnosticFilename(profileId, date = new Date()) {
  const timestamp = date.toISOString().replaceAll(":", "-").replaceAll(".", "-");
  return `tarjetas-${profileId}-diagnostic-${timestamp}.json`;
}

export function downloadDiagnostic(
  documentObject,
  urlObject,
  payload,
  filename,
  schedule = globalThis.setTimeout,
) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json",
  });
  const url = urlObject.createObjectURL(blob);
  const link = documentObject.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  documentObject.body.append(link);
  link.click();
  link.remove();
  schedule(() => urlObject.revokeObjectURL(url), 1000);
}
