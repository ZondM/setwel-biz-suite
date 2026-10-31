import { PackageTier } from '../core/types';

export interface PackageDef {
  tier: PackageTier;
  name: string;
  tagline: string;
  priceMonthly: string;
  priceYearly: string;
  audience: string;
  features: string[];
  notIncluded: string[];
  uniqueEdge?: string[]; // What competitors DON'T offer
}

// Only list what the app really does today. Anything planned is marked "coming soon".
export const PACKAGES: PackageDef[] = [
  {
    tier: 'hustler',
    name: 'Hustler',
    tagline: 'For spaza shops, hawkers and side hustles',
    priceMonthly: 'R59.99/month',
    priceYearly: 'R599/year',
    audience: 'Spaza shops, hawkers, home businesses, first-time business owners',
    features: [
      'Quotes that turn into invoices in one click',
      'PDF invoices to send on WhatsApp or email',
      'Repeating invoices that create themselves',
      'Payment reminders for overdue invoices',
      'Scan receipts with AI: 30 a month',
      'Income and expenses by category',
      'VAT worked out at 15%',
      'Tax deadline alerts and a monthly report',
      'Up to 50 customers and 100 invoices a month',
      'Works with no internet'
    ],
    notIncluded: ['Suppliers and bills', 'Bank statement matching']
  },
  {
    tier: 'grinder',
    name: 'Grinder',
    tagline: 'For growing small businesses and trades',
    priceMonthly: 'R199/month',
    priceYearly: 'R1,990/year',
    audience: 'Freelancers, sole proprietors, trades, small retailers',
    features: [
      'Everything in Hustler',
      'Unlimited customers and invoices',
      'Scan receipts with AI: 150 a month',
      'Suppliers and bills you owe',
      'Who owes you, and who you owe (aged reports)',
      'Profit and loss statement',
      'VAT201 figures ready for eFiling',
      'Provisional and income tax estimates'
    ],
    notIncluded: ['Bank statement matching']
  },
  {
    tier: 'builder',
    name: 'Builder',
    tagline: 'For established businesses with staff',
    priceMonthly: 'R399/month',
    priceYearly: 'R3,990/year',
    audience: 'Established SMEs and VAT vendors',
    features: [
      'Everything in Grinder',
      'Bank statement matching: upload your statement, Setwel matches payments',
      'Unlimited AI receipt scans',
      'Help loading your customers and opening balances',
      'Coming soon: payroll, stock'
    ],
    notIncluded: []
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    tagline: 'For larger and multi-branch businesses',
    priceMonthly: 'R999/month',
    priceYearly: 'R9,990/year',
    audience: 'Larger SMEs',
    features: [
      'Everything in Builder',
      'Several businesses or branches in one app',
      'Combined report across all your businesses',
      'Budgets with over-spend warnings',
      '13-week cash-flow forecast',
      'Staff logins with owner and staff roles',
      'Change history: who changed what, and when',
      'Month-end pack for your accountant',
      'Setup and training by a Setwel partner accountant',
      'Priority help on WhatsApp'
    ],
    notIncluded: []
  },
  {
    tier: 'accountant_partner',
    name: 'Accountant Partner',
    tagline: 'For accountants and bookkeepers with clients',
    priceMonthly: 'R1,499/month',
    priceYearly: 'Monthly billing',
    audience: 'Bookkeepers, accounting firms, tax practitioners',
    features: [
      'Unlimited client files in one app',
      'Practice dashboard: every client\'s VAT and tax deadlines and money owed',
      'Clients send you their books in one file; you import it',
      'VAT summary for all clients in one table',
      'Your firm\'s name and logo on the reports you prepare',
      'Setup checklist, spreadsheet imports and opening balances',
      'Training manual and trainer notes to train your clients',
      'Listed on Find an accountant; clients needing setup and training are sent to you',
      'All Enterprise features, and a referral code'
    ],
    notIncluded: []
  }
];
