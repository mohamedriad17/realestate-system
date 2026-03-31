const Contract  = require('../models/Contract');
const Property  = require('../models/Property');

exports.getTenants = async (req, res) => {
  try {
    const now = new Date();
    const properties = await Property.find({ isDeleted: false }).sort({ name: 1 });

    const result = await Promise.all(properties.map(async (prop) => {
      const contracts = await Contract.find({ property: prop._id, status: 'active' })
        .populate('apartment', 'number rooms halls hasKitchen bathrooms')
        .sort({ 'apartment.number': 1 });

      const tenants = contracts.map(c => {
        const daysLeft = Math.ceil((new Date(c.endDate) - now) / (1000 * 60 * 60 * 24));
        const nextPayment = c.paymentSchedule.find(p => !p.isPaid && new Date(p.dueDate) >= now);

        return {
          contractId: c._id,
          apartment: c.apartment,
          tenantName: c.tenantName,
          tenantPhone: c.tenantPhone,
          annualRent: c.annualRent,
          deposit: c.deposit,
          startDate: c.startDate,
          endDate: c.endDate,
          daysLeft,
          nextPayment: nextPayment ? { date: nextPayment.dueDate, amount: nextPayment.amount } : null,
          isExpiringSoon: daysLeft <= 30 && daysLeft > 0,
          isExpired: daysLeft <= 0
        };
      });

      return { property: { _id: prop._id, name: prop.name, address: prop.address }, tenants };
    }));

    // Filter out properties with no tenants
    const filtered = result.filter(r => r.tenants.length > 0);
    res.json({ success: true, data: filtered });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
