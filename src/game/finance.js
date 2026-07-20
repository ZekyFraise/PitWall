const MAX_TRANSACTIONS = 200;
const MAX_FINANCE_HISTORY = 52;

export const TRANSACTION_LABELS = {
  "race-prize": "Primes de course",
  "season-title-bonus": "Prime de titre",
  "amateur-fee": "Frais de gestion (amateurs)",
  "pro-commission": "Commissions passage pro",
  "random-event": "Événements",
  "staff-wage": "Salaires staff",
  "infrastructure-upkeep": "Entretien infrastructures",
  investment: "Budget course",
  "sign-driver": "Signatures",
  scout: "Scouting",
  "renew-contract": "Renouvellements",
  "seat-cost": "Coûts d'écurie",
  "recruitment-budget": "Budgets de recrutement",
  "hire-staff": "Recrutement staff",
  "facility-upgrade": "Investissements infrastructure",
  "approach-driver": "Recrutement pilotes établis",
  "shop-purchase": "Achats agence",
  "poach-buyout": "Indemnités de départ",
  "driver-release": "Résiliations de contrat",
  "dev-tool": "Outils développeur",
  loan: "Prêt",
  "loan-repayment": "Remboursement de prêt",
};

export function recordTransaction(state, type, label, amount) {
  if (!amount) return;
  state.transactions.push({ week: state.week, type, label, amount: Math.round(amount) });
  if (state.transactions.length > MAX_TRANSACTIONS) {
    state.transactions.splice(0, state.transactions.length - MAX_TRANSACTIONS);
  }
}

export function recordBalanceSnapshot(state) {
  state.financeHistory.push({ week: state.week, balance: Math.round(state.agency.money) });
  if (state.financeHistory.length > MAX_FINANCE_HISTORY) {
    state.financeHistory.splice(0, state.financeHistory.length - MAX_FINANCE_HISTORY);
  }
}

// Buckets transactions into fixed-size week ranges (1 = weekly columns, 4 = monthly,
// SEASON_WEEKS = yearly) so the finance bar chart can show whichever granularity the player
// picks instead of always one column per week.
export function aggregatedTotals(state, windowWeeks, bucketWeeks = 1) {
  const currentWeek = state.week;
  const startWeek = Math.max(1, currentWeek - windowWeeks + 1);
  const bucketCount = Math.max(1, Math.ceil((currentWeek - startWeek + 1) / bucketWeeks));
  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const bucketStart = startWeek + i * bucketWeeks;
    const bucketEnd = Math.min(currentWeek, bucketStart + bucketWeeks - 1);
    return { startWeek: bucketStart, endWeek: bucketEnd, income: 0, expenses: 0 };
  });
  for (const tx of state.transactions) {
    if (tx.week < startWeek || tx.week > currentWeek) continue;
    const bucket = buckets[Math.floor((tx.week - startWeek) / bucketWeeks)];
    if (!bucket) continue;
    if (tx.amount > 0) bucket.income += tx.amount;
    else bucket.expenses += -tx.amount;
  }
  return buckets;
}

export function breakdownByType(state, weeks = 10) {
  const startWeek = Math.max(1, state.week - weeks + 1);
  const income = new Map();
  const expenses = new Map();
  for (const tx of state.transactions) {
    if (tx.week < startWeek) continue;
    const map = tx.amount > 0 ? income : expenses;
    const label = TRANSACTION_LABELS[tx.type] ?? tx.type;
    map.set(label, (map.get(label) ?? 0) + Math.abs(tx.amount));
  }
  const toSortedArray = (map) =>
    [...map.entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
  return { income: toSortedArray(income), expenses: toSortedArray(expenses) };
}
