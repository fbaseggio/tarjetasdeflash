import { APP_RELEASE_DATE, APP_VERSION, DIAGNOSTIC_EXPORT_VERSION } from "./app-version.js?v=0.9.1";

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
