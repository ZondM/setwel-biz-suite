// SARS tax rates and thresholds.
//
// Sources (verified against sars.gov.za directly):
//  - Rates of Tax for Individuals: https://www.sars.gov.za/tax-rates/income-tax/rates-of-tax-for-individuals/
//  - Skills Development Levy:      https://www.sars.gov.za/types-of-tax/skills-development-levy/
//
// Tax rates change every year at the February Budget Speech. DO NOT hardcode these as
// permanent truths in any downstream code — always read through this file, and update
// this file (or better, let the in-app "Tax Tables" settings screen override it) each
// year once SARS publishes new figures. A note to that effect is also shown in-app.

import { TaxYearTable } from './types';

export const VAT_RATE = 0.15;
export const VAT_REGISTRATION_THRESHOLD = 1_000_000; // mandatory registration, 12-month rolling turnover
export const CORPORATE_TAX_RATE = 0.27; // flat rate for companies / CCs, 2026/27 tax year, unchanged from prior year

export const UIF_EMPLOYEE_RATE = 0.01;
export const UIF_EMPLOYER_RATE = 0.01;
export const UIF_MONTHLY_CEILING = 17_712; // earnings ceiling per month
export const UIF_MONTHLY_MAX_CONTRIBUTION = 177.12; // per party

export const SDL_RATE = 0.01; // 1% of total payroll, employer-only contribution
export const SDL_ANNUAL_PAYROLL_THRESHOLD = 500_000; // employers below this are exempt

// 2027 tax year: 1 March 2026 - 28 February 2027 (current at time of writing)
export const TAX_TABLE_2027: TaxYearTable = {
  taxYear: '2027',
  startDate: '2026-03-01',
  endDate: '2027-02-28',
  brackets: [
    { min: 0, max: 245_100, base: 0, rate: 0.18 },
    { min: 245_101, max: 383_100, base: 44_118, rate: 0.26 },
    { min: 383_101, max: 530_200, base: 79_998, rate: 0.31 },
    { min: 530_201, max: 695_800, base: 125_599, rate: 0.36 },
    { min: 695_801, max: 887_000, base: 185_215, rate: 0.39 },
    { min: 887_001, max: 1_878_600, base: 259_783, rate: 0.41 },
    { min: 1_878_601, max: null, base: 666_339, rate: 0.45 }
  ],
  primaryRebate: 17_820,
  secondaryRebate: 9_765,
  tertiaryRebate: 3_249,
  thresholdUnder65: 99_000,
  threshold65to74: 153_250,
  threshold75plus: 171_300
};

// 2026 tax year: 1 March 2025 - 28 February 2026 (kept for businesses still finalising that year)
export const TAX_TABLE_2026: TaxYearTable = {
  taxYear: '2026',
  startDate: '2025-03-01',
  endDate: '2026-02-28',
  brackets: [
    { min: 0, max: 237_100, base: 0, rate: 0.18 },
    { min: 237_101, max: 370_500, base: 42_678, rate: 0.26 },
    { min: 370_501, max: 512_800, base: 77_362, rate: 0.31 },
    { min: 512_801, max: 673_000, base: 121_475, rate: 0.36 },
    { min: 673_001, max: 857_900, base: 179_147, rate: 0.39 },
    { min: 857_901, max: 1_817_000, base: 251_258, rate: 0.41 },
    { min: 1_817_001, max: null, base: 644_489, rate: 0.45 }
  ],
  primaryRebate: 17_235,
  secondaryRebate: 9_444,
  tertiaryRebate: 3_145,
  thresholdUnder65: 95_750,
  threshold65to74: 148_217,
  threshold75plus: 165_689
};

export const TAX_TABLES: Record<string, TaxYearTable> = {
  '2026': TAX_TABLE_2026,
  '2027': TAX_TABLE_2027
};

/** Picks the tax table whose start/end date contains the given ISO date, falling back to the latest known table. */
export function getTaxTableForDate(isoDate: string): TaxYearTable {
  const tables = Object.values(TAX_TABLES).sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  for (const t of tables) {
    if (isoDate >= t.startDate && isoDate <= t.endDate) return t;
  }
  return tables[0];
}

/** Provisional tax payment deadlines for a March-year-end taxpayer (the SA default). */
export function getProvisionalTaxDeadlines(taxYear: string) {
  const table = TAX_TABLES[taxYear];
  if (!table) return null;
  const endYear = Number(table.endDate.slice(0, 4));
  return {
    firstPeriod: `${endYear - 1}-08-31`,
    secondPeriod: `${endYear}-02-28`,
    voluntaryTopUp: `${endYear}-09-30`
  };
}
