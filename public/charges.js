// Cash out charges for bKash, Nagad and Rocket. All published rates include VAT.
// Checked 8 October 2026:
//  - bKash: https://www.bkash.com/en/products-services/cashout and /cashout/cashout-from-agent and /cash-out-from-atm
//    Priyo Agent Tk 13.95 per 1,000 up to Tk 50,000 per calendar month (2 Priyo numbers); other agents Tk 18.50;
//    BRAC Bank, City Bank and Q-Cash ATMs Tk 14.90. A transaction that takes the monthly Priyo total over
//    Tk 50,000 is charged Tk 18.50 per 1,000 in full (bKash's own example).
//  - Rocket (Dutch-Bangla Bank): https://www.dutchbanglabank.com/rocket/charges-and-fees.html
//    General: agent 1.67%, DBBL branch 0.9%, DBBL ATM 0.9%. Salary & stipend: agent 0.9%, branch Tk 10 per txn, ATM free.
//  - Nagad: app Tk 12.99 and *167# Tk 15.00 per 1,000; Nagad Islamic Tk 15.00. nagad.com.bd blocks automated
//    checks, so these are UNVERIFIED against the official page and editable in the app.

export const RATES = {
  bkash: {
    name: 'bKash', nameBn: 'বিকাশ', verified: true,
    methods: {
      priyo: { label: 'Priyo Agent (app or *247#)', labelBn: 'প্রিয় এজেন্ট (অ্যাপ বা *২৪৭#)', perThousand: 13.95, monthlyLimit: 50000, overRate: 18.50 },
      agent: { label: 'Any other agent', labelBn: 'অন্য যেকোনো এজেন্ট', perThousand: 18.50 },
      atm: { label: 'ATM (BRAC, City Bank, Q-Cash)', labelBn: 'এটিএম (ব্র্যাক, সিটি ব্যাংক, কিউ-ক্যাশ)', perThousand: 14.90 },
    },
  },
  nagad: {
    name: 'Nagad', nameBn: 'নগদ', verified: false,
    methods: {
      app: { label: 'Nagad app', labelBn: 'নগদ অ্যাপ', perThousand: 12.99 },
      ussd: { label: 'USSD *167#', labelBn: 'ইউএসএসডি *১৬৭#', perThousand: 15.00 },
      islamic: { label: 'Nagad Islamic (app or USSD)', labelBn: 'নগদ ইসলামিক (অ্যাপ বা ইউএসএসডি)', perThousand: 15.00 },
    },
  },
  rocket: {
    name: 'Rocket', nameBn: 'রকেট', verified: true,
    methods: {
      agent: { label: 'Agent', labelBn: 'এজেন্ট', perThousand: 16.70, salary: 9.00 },
      atm: { label: 'DBBL ATM', labelBn: 'ডাচ্-বাংলা ব্যাংক এটিএম', perThousand: 9.00, salary: 0 },
      branch: { label: 'DBBL branch', labelBn: 'ডাচ্-বাংলা ব্যাংক শাখা', perThousand: 9.00, salaryFlat: 10 },
    },
  },
};

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Effective per-1,000 rate for a method (handles Priyo over-limit and Rocket salary accounts). */
export function rateFor(provider, method, { usedThisMonth = 0, amount = 0, salaryAccount = false, rates = RATES } = {}) {
  const m = rates[provider]?.methods?.[method];
  if (!m) return null;
  if (provider === 'bkash' && method === 'priyo' && usedThisMonth + amount > m.monthlyLimit) return { perThousand: m.overRate, overLimit: true };
  if (provider === 'rocket' && salaryAccount) {
    if (m.salaryFlat != null) return { flat: m.salaryFlat, perThousand: 0 };
    return { perThousand: m.salary };
  }
  return { perThousand: m.perThousand };
}

export function charge(provider, method, amount, opts = {}) {
  amount = Math.max(0, +amount || 0);
  const rt = rateFor(provider, method, { ...opts, amount });
  if (!rt) return null;
  const fee = rt.flat != null ? (amount > 0 ? rt.flat : 0) : (amount * rt.perThousand) / 1000;
  return { provider, method, amount, fee: r2(fee), total: r2(amount + fee), perThousand: rt.perThousand, flat: rt.flat ?? null, overLimit: !!rt.overLimit };
}

/** Largest cash out you can make from a balance (amount + fee ≤ balance), to the nearest taka. */
export function maxFromBalance(provider, method, balance, opts = {}) {
  balance = Math.max(0, +balance || 0);
  let a = Math.floor(balance);
  // start from the analytic answer and step down until it fits (handles rounding, flat fees and the Priyo limit)
  const rt = rateFor(provider, method, { ...opts, amount: 0 });
  if (rt && rt.flat == null) a = Math.floor(balance / (1 + rt.perThousand / 1000));
  while (a > 0 && charge(provider, method, a, opts).total > balance) a--;
  return a;
}

export function compareAll(amount, opts = {}) {
  const out = [];
  for (const [p, cfg] of Object.entries(opts.rates || RATES)) {
    for (const m of Object.keys(cfg.methods)) out.push({ ...charge(p, m, amount, opts), name: cfg.name, nameBn: cfg.nameBn, label: cfg.methods[m].label, labelBn: cfg.methods[m].labelBn, verified: cfg.verified });
  }
  return out.sort((a, b) => a.fee - b.fee);
}
