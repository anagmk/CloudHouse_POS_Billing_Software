export const SEED_MARKER = "stockpilot-development-seed-v1";
export const SEED_EMAIL_DOMAIN = "stockpilot-seed.invalid";
export const PAYMENT_METHODS = ["cash", "upi", "card", "bank", "other"];

export const roundMoney = (amount) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

export const makeRandom = (seed = 20_261_103) => {
  let state = seed >>> 0;

  return {
    integer(min, max) {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return min + (state % (max - min + 1));
    },
    pick(items) {
      return items[this.integer(0, items.length - 1)];
    },
  };
};

export const dateAt = (daysAgo, hour, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date;
};

export const paymentAccount = {
  cash: "Cash",
  upi: "UPI clearing",
  card: "Card clearing",
  bank: "Bank",
  other: "Other payment clearing",
};

export const createPayments = ({ amount, method, split = false }) => {
  const total = roundMoney(amount);
  if (total <= 0) return [];
  if (!split || total < 2) return [{ method, amount: total }];

  const firstAmount = roundMoney(total * 0.6);
  const secondMethod = PAYMENT_METHODS.find((item) => item !== method);
  return [
    { method, amount: firstAmount },
    { method: secondMethod, amount: roundMoney(total - firstAmount) },
  ];
};

export const summarizeCounts = (counts) =>
  Object.entries(counts)
    .map(([collection, count]) => `  ${collection}: ${count}`)
    .join("\n");
