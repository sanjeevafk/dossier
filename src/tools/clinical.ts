export interface ClinicalEvidence {
  nctId: string;
  title: string;
  status: string;
  phase: string;
  sponsor: string;
  studyUrl: string;
}

export interface DeviceClearance {
  applicant: string;
  deviceName: string;
  decisionDate: string;
  clearanceUrl: string;
}

export interface ClinicalReconResult {
  query: string;
  source: string;
  totalStudies: number;
  studies: ClinicalEvidence[];
  clearances: DeviceClearance[];
  keyTakeaway: string;
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Query ClinicalTrials.gov v2 + openFDA 510(k) (both keyless) for healthcare
 * dossiers: active trials and cleared predicate devices. Turns "regulatory
 * drag" from hand-waving into cited trials and clearances. Honest empty when
 * the domain is not healthcare or nothing matches.
 */
export async function queryClinicalEvidence(
  keyword: string,
  healthcareOnly = true,
  fetchImpl: FetchImpl = fetch
): Promise<ClinicalReconResult> {
  const cleanKeyword = keyword.trim().slice(0, 120);

  const empty = (reason: string): ClinicalReconResult => ({
    query: cleanKeyword,
    source: "ClinicalTrials.gov v2 + openFDA 510(k) (keyless)",
    totalStudies: 0,
    studies: [],
    clearances: [],
    keyTakeaway: reason
  });

  if (!cleanKeyword) return empty("Empty query — no clinical search performed.");
  if (!healthcareOnly) return empty("Non-healthcare concept — clinical registries not applicable.");

  const studies: ClinicalEvidence[] = [];
  let totalStudies = 0;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const url = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(cleanKeyword)}&countTotal=true&pageSize=5&fields=NCTId,BriefTitle,OverallStatus,Phase,LeadSponsorName`;
    const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      totalStudies = Number(data?.totalCount) || 0;
      for (const s of (data?.studies || []).slice(0, 3)) {
        const ps = s?.protocolSection || {};
        const idm = ps.identificationModule || {};
        const sponsor = ps.sponsorCollaboratorsModule?.leadSponsor?.name || "Unknown sponsor";
        const phases = ps.designModule?.phases || [];
        studies.push({
          nctId: String(idm.nctId || ""),
          title: String(idm.briefTitle || "").slice(0, 120),
          status: String(ps.statusModule?.overallStatus || "UNKNOWN"),
          phase: Array.isArray(phases) && phases.length > 0 ? String(phases[0]) : "N/A",
          sponsor: String(sponsor).slice(0, 80),
          studyUrl: idm.nctId ? `https://clinicaltrials.gov/study/${idm.nctId}` : ""
        });
      }
    }
  } catch {
    // trials unreachable — still try FDA below
  }

  const clearances: DeviceClearance[] = [];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const url = `https://api.fda.gov/device/510k.json?search=device_name:${encodeURIComponent(`"${cleanKeyword}"`)}&limit=3`;
    const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      for (const r of (data?.results || []).slice(0, 2)) {
        clearances.push({
          applicant: String(r.applicant || "Unknown").slice(0, 80),
          deviceName: String(r.device_name || "").slice(0, 100),
          decisionDate: String(r.decision_date || "unknown"),
          clearanceUrl: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=${encodeURIComponent(String(r.k_number || ""))}`
        });
      }
    }
  } catch {
    // FDA unreachable — trials alone still count
  }

  if (studies.length === 0 && clearances.length === 0) {
    return empty(`No trials (${totalStudies} total hits, none parseable) or 510(k) clearances match "${cleanKeyword}".`);
  }
  return {
    query: cleanKeyword,
    source: "ClinicalTrials.gov v2 + openFDA 510(k) (keyless)",
    totalStudies,
    studies,
    clearances,
    keyTakeaway: `${totalStudies} trial(s) match "${cleanKeyword}"${studies[0] ? ` (e.g. ${studies[0].nctId}, ${studies[0].status})` : ""}${clearances.length > 0 ? `; ${clearances.length} 510(k) predicate clearance(s) found` : "; no 510(k) predicate found"} — regulatory path evidence, not approval.`
  };
}
