// Government procurement portals (OCDS).
//
// The best BD source in this system, for a reason nothing else matches: a
// tender is a buyer telling you, in public and in writing, that they intend to
// spend money, on what, and by when. There is no inference and no sentiment —
// it is a dated commitment with a closing date attached.
//
// Both portals below serve the Open Contracting Data Standard as JSON, with no
// API key. Neither supports keyword search, so notices are fetched by date
// window and filtered here on CPV classification codes and title text.

import { log } from './log.js';

const UA = 'SignalBureau/1.0 (+https://github.com/; BD intelligence research)';

export const PORTALS = [
  {
    key: 'find-a-tender',
    name: 'UK Find a Tender',
    // Higher-value and above-threshold UK public contracts.
    url: (from) => `https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?updatedFrom=${from}&limit=100`,
    noticeUrl: (id) => `https://www.find-tender.service.gov.uk/Notice/${encodeURIComponent(id)}`,
  },
  {
    key: 'contracts-finder',
    name: 'UK Contracts Finder',
    url: (from) => `https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?publishedFrom=${from}&limit=100`,
    noticeUrl: (id) => `https://www.contractsfinder.service.gov.uk/Notice/${encodeURIComponent(id)}`,
  },
];

// CPV codes covering compute, servers, data centres and AI/IT services.
// Matched on prefix, so "48820000" is caught by "488".
// Narrow on purpose: servers, mainframes, computer hardware and data-processing
// services. Broad IT codes such as 48000000 (software packages) match almost
// any public-sector contract and were dropped after they filled the results
// with websites and office software.
export const CPV_PREFIXES = [
  '30211', // mainframe / supercomputers
  '30212', // minicomputers
  '48820', // servers
  '48821', // network servers
  '30230', // computer-related equipment
  '72315', // data network management
  '72320', // database services
  '72510', // computer-related management services
];

// Deliberately specific. An earlier version included " ai " as a term, which
// matched incidental text and filled the results with website and social-media
// contracts — precision matters more than recall here, because every false
// positive costs a verification slot downstream.
export const DEFAULT_TERMS = [
  'artificial intelligence', 'machine learning', 'deep learning',
  'gpu', 'graphics processing', 'hpc', 'high performance computing',
  'supercomput', 'data centre', 'data center', 'ai infrastructure',
  'ai platform', 'ai capability', 'ai solution', 'ai service',
  'inference', 'accelerator', 'nvidia', 'cloud compute', 'cloud infrastructure',
  'large language model', 'generative ai', 'llm',
];

/**
 * Fetch recent notices from one portal, following pagination up to a cap.
 * A portal that fails is logged and skipped — never fatal.
 */
export async function fetchPortal(portal, { days = 30, maxPages = 10, timeoutMs = 45000 } = {}) {
  const from = new Date(Date.now() - days * 864e5).toISOString().slice(0, 19);
  let url = portal.url(from);
  const releases = [];

  try {
    for (let page = 0; page < maxPages && url; page++) {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const batch = data.releases ?? [];
      releases.push(...batch.map((r) => ({ ...r, _portal: portal })));
      url = batch.length ? data.links?.next : null;
    }
    log.step(`${portal.name} → ${releases.length} notices in the last ${days} days`);
  } catch (err) {
    log.warn(`${portal.name} failed, skipping — ${err.message}`);
  }
  return releases;
}

export async function fetchPortals(portals = PORTALS, opts) {
  const all = await Promise.all(portals.map((p) => fetchPortal(p, opts)));
  return all.flat();
}

/**
 * Is this an opportunity you can still bid for?
 *
 * Procurement portals publish the whole lifecycle — planned, open, awarded,
 * cancelled. An award notice names a contract someone else has already won,
 * which is useful competitive intelligence but is not a lead. An earlier
 * version returned tenders that closed in July as live opportunities.
 */
export function isOpen(release, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const t = release.tender ?? {};
  const end = (t.tenderPeriod?.endDate ?? t.enquiryPeriod?.endDate ?? '').slice(0, 10);
  if (end) return end >= today;
  // No stated closing date: trust the status, and treat a completed or
  // cancelled procurement as closed.
  const status = String(t.status ?? '').toLowerCase();
  if (['complete', 'cancelled', 'unsuccessful', 'withdrawn'].includes(status)) return false;
  // An award notice carries the winner, whatever its status says.
  if (Array.isArray(release.awards) && release.awards.length) return false;
  return true;
}

/** Keep only notices plausibly about compute, AI or data-centre work. */
export function relevant(releases, { terms = DEFAULT_TERMS, cpvPrefixes = CPV_PREFIXES } = {}) {
  const seen = new Set();
  return releases.filter((r) => {
    const t = r.tender ?? {};
    const id = r.ocid ?? t.id;
    if (id && seen.has(id)) return false;        // the same notice is republished on amendment

    const text = `${t.title ?? ''} ${t.description ?? ''}`.toLowerCase();
    const cpv = String(t.classification?.id ?? '');

    // A keyword alone is enough; a CPV code alone is only enough for the
    // narrowly computing-related codes, since broad IT codes cover everything
    // from a college website to a payroll system.
    const byTerm = terms.some((term) => text.includes(term));
    const byCpv = cpv && cpvPrefixes.some((p) => cpv.startsWith(p));
    if (!byTerm && !byCpv) return false;

    if (id) seen.add(id);
    return true;
  });
}

/**
 * Convert an OCDS release into a signal. No model involved — every field is
 * copied from the notice, which is why this path cannot hallucinate.
 */
export function toSignal(release, { category = 'tender' } = {}) {
  const open = isOpen(release);
  const t = release.tender ?? {};
  const buyer = release.buyer?.name ?? t.procuringEntity?.name ?? 'Unnamed public body';
  const deadline = t.tenderPeriod?.endDate ?? t.enquiryPeriod?.endDate ?? null;
  const value = t.value?.amount ?? null;
  const currency = t.value?.currency ?? 'GBP';
  const url = release._portal?.noticeUrl?.(release.ocid ?? t.id) ?? release.uri ?? '';

  const parts = [`${buyer} published a tender: ${t.title ?? 'untitled notice'}`];
  if (!open) parts.push('(already closed — competitive intelligence, not a live bid)');
  if (value) parts.push(`valued at ${currency} ${Number(value).toLocaleString('en-GB')}`);
  if (deadline) parts.push(`closing ${deadline.slice(0, 10)}`);

  return {
    company: buyer,
    signal_type: 'Published Tender',
    summary: `${parts.join(', ')}.`,
    url,
    url_key: (url || `${release.ocid}`).toLowerCase(),
    date: (release.date ?? '').slice(0, 10) || null,
    deadline: deadline ? deadline.slice(0, 10) : null,
    contract_value: value,
    contract_currency: value ? currency : null,
    cpv: t.classification?.id ?? null,
    tender_open: open,
    // A closed notice is never urgent, however recent it is.
    relevance_score: open ? 8 : 5,
    category,
    source_title: t.title ?? '',
    found_via: release._portal?.name ?? 'procurement portal',
    collected_at: new Date().toISOString(),
    // A notice is its own evidence: the buyer wrote it, so there is nothing to
    // ground against a third-party article.
    source_is_about_company: true,
    weak_source: false,
    grounding_note: null,
    description: (t.description ?? '').slice(0, 600),
  };
}
