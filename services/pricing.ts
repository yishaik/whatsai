// Rough, client-side cost estimation for the usage dashboard. Prices are
// approximate USD per 1M tokens and WILL drift — always label the result as an
// estimate. Unknown models return null (cost shown as "—").

interface Price {
  in: number; // USD per 1M input tokens
  out: number; // USD per 1M output tokens
}

// Order matters: more specific patterns first.
const PRICES: { match: RegExp; price: Price }[] = [
  { match: /^gpt-4o-mini/, price: { in: 0.15, out: 0.6 } },
  { match: /^gpt-4o/, price: { in: 2.5, out: 10 } },
  { match: /^gpt-4\.1-nano/, price: { in: 0.1, out: 0.4 } },
  { match: /^gpt-4\.1-mini/, price: { in: 0.4, out: 1.6 } },
  { match: /^gpt-4\.1/, price: { in: 2.0, out: 8.0 } },
  { match: /^o\d.*mini/, price: { in: 1.1, out: 4.4 } },
  { match: /flash-lite/, price: { in: 0.1, out: 0.4 } },
  { match: /2\.5-flash/, price: { in: 0.3, out: 2.5 } },
  { match: /2\.0-flash/, price: { in: 0.1, out: 0.4 } },
  { match: /1\.5-flash/, price: { in: 0.075, out: 0.3 } },
  { match: /1\.5-pro/, price: { in: 1.25, out: 5.0 } },
  { match: /flash/, price: { in: 0.3, out: 2.5 } },
];

// Estimated USD cost, or null if the model's pricing is unknown.
export const estimateCostUsd = (model: string, inputTokens: number, outputTokens: number): number | null => {
  const entry = PRICES.find((p) => p.match.test(model));
  if (!entry) return null;
  return (inputTokens / 1e6) * entry.price.in + (outputTokens / 1e6) * entry.price.out;
};

export const formatUsd = (value: number): string => {
  if (value === 0) return '$0.00';
  if (value < 0.01) return `<$0.01`;
  return `$${value.toFixed(2)}`;
};
