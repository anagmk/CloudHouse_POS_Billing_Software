import LedgerEntry from "../models/LedgerEntry.model.js";
import Payment from "../models/Payment.model.js";
import StockMovement from "../models/StockMovement.model.js";
import { randomUUID } from "node:crypto";

export const writeLedgerEntries = async (session, entries) => {
  if (entries.length) await LedgerEntry.insertMany(entries, { session });
};

export const writePayments = async (
  session,
  {
    payments,
    direction,
    purpose,
    relatedType,
    relatedId,
    partyType,
    partyId,
    createdBy,
  },
) => {
  if (!payments.length) return;
  const documents = payments.map((payment, index) => ({
    paymentNumber: `PAY-${randomUUID().slice(0, 12).toUpperCase()}`,
    direction,
    purpose,
    relatedType,
    relatedId,
    partyType,
    partyId,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
    createdBy,
  }));
  await Payment.insertMany(documents, { session });
};

export const writeStockMovement = async (session, movement) => {
  await StockMovement.create([movement], { session });
};

export const makeLedgerRows = ({
  sourceType,
  sourceId,
  reference,
  transactionType,
  createdBy,
  partyType,
  partyId,
  description,
  credits = [],
  debits = [],
}) => {
  const rows = [];
  const common = {
    sourceType,
    sourceId,
    reference,
    transactionType,
    createdBy,
    partyType,
    partyId,
    description,
  };
  debits
    .filter((row) => row.amount > 0)
    .forEach((row, index) =>
      rows.push({
        ...common,
        entryKey: `${sourceType}:${sourceId}:${transactionType}:debit:${index}`,
        account: row.account,
        debit: row.amount,
        paymentMethod: row.paymentMethod,
      }),
    );
  credits
    .filter((row) => row.amount > 0)
    .forEach((row, index) =>
      rows.push({
        ...common,
        entryKey: `${sourceType}:${sourceId}:${transactionType}:credit:${index}`,
        account: row.account,
        credit: row.amount,
        paymentMethod: row.paymentMethod,
      }),
    );
  return rows;
};
