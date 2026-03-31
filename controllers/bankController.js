const Contract = require('../models/Contract');
const Expense  = require('../models/Expense');

// GET /api/bank  — unified ledger: income (rent/deposit/commission) + expenses
exports.getBankLedger = async (req, res) => {
  try {
    const { month, year, type } = req.query;

    const buildDateFilter = (field) => {
      const f = {};
      if (year) {
        const y = parseInt(year);
        f[field] = { $gte: new Date(y, 0, 1), $lte: new Date(y, 11, 31, 23, 59, 59) };
      }
      if (year && month) {
        const y = parseInt(year), m = parseInt(month) - 1;
        f[field] = { $gte: new Date(y, m, 1), $lte: new Date(y, m + 1, 0, 23, 59, 59) };
      }
      return f;
    };

    const entries = [];

    // ── Rent payments (income) ──────────────────────────────────────────────
    if (!type || type === 'rent') {
      const contracts = await Contract.find({})
        .populate('property', 'name')
        .populate('apartment', 'number')
        .lean();

      contracts.forEach(c => {
        c.paymentSchedule?.forEach(p => {
          if (!p.isPaid || !p.paidDate) return;
          const pd = new Date(p.paidDate);
          if (year  && pd.getFullYear() !== parseInt(year))  return;
          if (month && pd.getMonth() + 1 !== parseInt(month)) return;
          entries.push({
            date:     pd,
            type:     'rent',
            typeLabel:'إيجار',
            direction:'in',
            amount:   p.amount,
            property: c.property?.name,
            apartment:`شقة ${c.apartment?.number}`,
            tenant:   c.tenantName,
            source:   `${c.property?.name} — شقة ${c.apartment?.number} — ${c.tenantName}`,
            ref:      c._id
          });
        });

        // Deposit (recorded at contract creation date)
        if (!type || type === 'deposit') {
          if (c.deposit > 0) {
            const pd = new Date(c.createdAt);
            if (year  && pd.getFullYear() !== parseInt(year))  return;
            if (month && pd.getMonth() + 1 !== parseInt(month)) return;
            entries.push({
              date:     pd,
              type:     'deposit',
              typeLabel:'تأمين',
              direction:'in',
              amount:   c.deposit,
              property: c.property?.name,
              apartment:`شقة ${c.apartment?.number}`,
              tenant:   c.tenantName,
              source:   `تأمين — ${c.property?.name} — شقة ${c.apartment?.number}`,
              ref:      c._id
            });
          }
        }
      });
    }

    // ── Expenses (outflow) ──────────────────────────────────────────────────
    if (!type || type === 'expense') {
      const dateFilter = buildDateFilter('date');
      const expenses = await Expense.find(dateFilter)
        .populate('property', 'name')
        .populate('apartment', 'number')
        .lean();

      expenses.forEach(e => {
        const expTypeMap = { setup:'سعي', maintenance:'صيانة', commission:'عمولة', utility:'خدمات', other:'أخرى' };
        entries.push({
          date:     new Date(e.date),
          type:     'expense',
          typeLabel:`مصروف (${expTypeMap[e.type] || e.type})`,
          direction:'out',
          amount:   e.amount,
          property: e.property?.name,
          apartment:e.apartment ? `شقة ${e.apartment.number}` : null,
          tenant:   null,
          source:   e.description,
          voucherNumber: e.voucherNumber,
          ref:      e._id
        });
      });
    }

    // ── Sort by date ascending ───────────────────────────────────────────────
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    // ── Running balance ──────────────────────────────────────────────────────
    let balance = 0;
    const ledger = entries.map(e => {
      if (e.direction === 'in')  balance += e.amount;
      if (e.direction === 'out') balance -= e.amount;
      return { ...e, runningBalance: balance };
    });

    // ── Summary ──────────────────────────────────────────────────────────────
    const totalIn  = entries.filter(e => e.direction === 'in').reduce((s,e)=>s+e.amount, 0);
    const totalOut = entries.filter(e => e.direction === 'out').reduce((s,e)=>s+e.amount, 0);

    res.json({
      success: true,
      data: ledger.reverse(), // newest first for display
      summary: { totalIn, totalOut, netBalance: totalIn - totalOut, count: ledger.length }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
