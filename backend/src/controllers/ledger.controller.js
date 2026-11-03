import LedgerEntry from "../models/LedgerEntry.model.js";

export const listLedger = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const filter = {};
    if (
      [
        "sale",
        "purchase",
        "refund",
        "payment",
        "expense",
        "adjustment",
      ].includes(req.query.type)
    )
      filter.transactionType = req.query.type;
    if (["cash", "upi", "card", "bank", "other"].includes(req.query.method))
      filter.paymentMethod = req.query.method;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from && !Number.isNaN(Date.parse(req.query.from)))
        filter.date.$gte = new Date(req.query.from);
      if (req.query.to && !Number.isNaN(Date.parse(req.query.to)))
        filter.date.$lte = new Date(`${req.query.to}T23:59:59.999`);
    }
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { reference: { $regex: safe, $options: "i" } },
        { description: { $regex: safe, $options: "i" } },
        { account: { $regex: safe, $options: "i" } },
      ];
    }
    const sort =
      req.query.sort === "oldest" ? { date: 1, _id: 1 } : { date: -1, _id: -1 };
    const [entries, total, allTotals] = await Promise.all([
      LedgerEntry.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("createdBy", "username")
        .lean(),
      LedgerEntry.countDocuments(filter),
      LedgerEntry.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            debit: { $sum: "$debit" },
            credit: { $sum: "$credit" },
          },
        },
      ]),
    ]);
    let running = 0;
    if (entries.length) {
      if (sort.date === 1) {
        const first = entries[0];
        const prior = await LedgerEntry.aggregate([
          {
            $match: {
              $or: [
                { date: { $lt: first.date } },
                { date: first.date, _id: { $lt: first._id } },
              ],
            },
          },
          {
            $group: {
              _id: null,
              debit: { $sum: "$debit" },
              credit: { $sum: "$credit" },
            },
          },
        ]);
        running = (prior[0]?.debit || 0) - (prior[0]?.credit || 0);
        for (const entry of entries) {
          running += entry.debit - entry.credit;
          entry.balance = Math.round(running * 100) / 100;
        }
      } else {
        const first = entries[0];
        const throughFirst = await LedgerEntry.aggregate([
          {
            $match: {
              $or: [
                { date: { $lt: first.date } },
                { date: first.date, _id: { $lte: first._id } },
              ],
            },
          },
          {
            $group: {
              _id: null,
              debit: { $sum: "$debit" },
              credit: { $sum: "$credit" },
            },
          },
        ]);
        running =
          (throughFirst[0]?.debit || 0) - (throughFirst[0]?.credit || 0);
        for (const entry of entries) {
          entry.balance = Math.round(running * 100) / 100;
          running -= entry.debit - entry.credit;
        }
      }
    }
    return res.json({
      entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totals: {
        debit: allTotals[0]?.debit || 0,
        credit: allTotals[0]?.credit || 0,
        balance: (allTotals[0]?.debit || 0) - (allTotals[0]?.credit || 0),
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Could not load ledger", error: error.message });
  }
};
