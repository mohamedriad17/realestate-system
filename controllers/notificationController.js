const Contract = require('../models/Contract');

// GET /api/notifications
exports.getNotifications = async (req, res) => {
  try {
    const now   = new Date();
    const notifications = [];

    // ── Load active contracts with populated refs ─────────────────────────────
    const contracts = await Contract.find({ status: 'active' })
      .populate('property',  'name')
      .populate('apartment', 'number')
      .lean();

    contracts.forEach(contract => {
      const endDate  = new Date(contract.endDate);
      const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      const propName = contract.property?.name  || 'عقار غير معروف';
      const aptNum   = contract.apartment?.number ?? '?';
      const tenant   = contract.tenantName;

      // ── Contract expiry alerts ────────────────────────────────────────────
      if (daysLeft <= 0) {
        notifications.push({
          id:       `contract-expired-${contract._id}`,
          type:     'contract_expired',
          priority: 'critical',          // red
          title:    'عقد منتهي الصلاحية',
          message:  `عقد ${tenant} — ${propName} شقة ${aptNum} منتهٍ منذ ${Math.abs(daysLeft)} يوم`,
          daysLeft,
          contractId: contract._id,
          propertyName: propName,
          apartmentNumber: aptNum,
          tenantName: tenant,
          date: endDate,
          createdAt: new Date()
        });
      } else if (daysLeft <= 7) {
        notifications.push({
          id:       `contract-7-${contract._id}`,
          type:     'contract_expiring',
          priority: 'high',              // red
          title:    'عقد ينتهي خلال أسبوع',
          message:  `عقد ${tenant} — ${propName} شقة ${aptNum} ينتهي بعد ${daysLeft} أيام`,
          daysLeft,
          contractId: contract._id,
          propertyName: propName,
          apartmentNumber: aptNum,
          tenantName: tenant,
          date: endDate,
          createdAt: new Date()
        });
      } else if (daysLeft <= 15) {
        notifications.push({
          id:       `contract-15-${contract._id}`,
          type:     'contract_expiring',
          priority: 'medium',            // yellow
          title:    'عقد ينتهي خلال 15 يوم',
          message:  `عقد ${tenant} — ${propName} شقة ${aptNum} ينتهي بعد ${daysLeft} يوماً`,
          daysLeft,
          contractId: contract._id,
          propertyName: propName,
          apartmentNumber: aptNum,
          tenantName: tenant,
          date: endDate,
          createdAt: new Date()
        });
      } else if (daysLeft <= 30) {
        notifications.push({
          id:       `contract-30-${contract._id}`,
          type:     'contract_expiring',
          priority: 'low',               // blue
          title:    'عقد ينتهي خلال 30 يوم',
          message:  `عقد ${tenant} — ${propName} شقة ${aptNum} ينتهي بعد ${daysLeft} يوماً`,
          daysLeft,
          contractId: contract._id,
          propertyName: propName,
          apartmentNumber: aptNum,
          tenantName: tenant,
          date: endDate,
          createdAt: new Date()
        });
      }

      // ── Payment alerts ────────────────────────────────────────────────────
      contract.paymentSchedule?.forEach((payment, idx) => {
        if (payment.isPaid) return;

        const dueDate     = new Date(payment.dueDate);
        const daysOverdue = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24)); // positive = overdue
        const daysToDue   = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24)); // positive = future

        const amount = payment.amount?.toLocaleString('ar-EG') + ' ر.س';

        // Overdue payments
        if (daysOverdue > 0) {
          notifications.push({
            id:       `payment-overdue-${contract._id}-${idx}`,
            type:     'payment_overdue',
            priority: 'critical',        // red
            title:    'دفعة متأخرة',
            message:  `${tenant} — ${propName} شقة ${aptNum}: دفعة ${amount} متأخرة ${daysOverdue} يوم`,
            daysOverdue,
            contractId: contract._id,
            paymentId:  payment._id,
            propertyName: propName,
            apartmentNumber: aptNum,
            tenantName: tenant,
            amount: payment.amount,
            date: dueDate,
            createdAt: new Date()
          });
        }
        // Due within 3 days (urgent)
        else if (daysToDue >= 0 && daysToDue <= 3) {
          notifications.push({
            id:       `payment-soon-${contract._id}-${idx}`,
            type:     'payment_due_soon',
            priority: 'high',            // red-orange
            title:    'دفعة تستحق قريباً',
            message:  `${tenant} — ${propName} شقة ${aptNum}: دفعة ${amount} تستحق ${daysToDue === 0 ? 'اليوم' : `بعد ${daysToDue} أيام`}`,
            daysToDue,
            contractId: contract._id,
            paymentId:  payment._id,
            propertyName: propName,
            apartmentNumber: aptNum,
            tenantName: tenant,
            amount: payment.amount,
            date: dueDate,
            createdAt: new Date()
          });
        }
        // Due within 10 days
        else if (daysToDue > 3 && daysToDue <= 10) {
          notifications.push({
            id:       `payment-upcoming-${contract._id}-${idx}`,
            type:     'payment_upcoming',
            priority: 'medium',          // yellow
            title:    'دفعة مستحقة قريباً',
            message:  `${tenant} — ${propName} شقة ${aptNum}: دفعة ${amount} تستحق بعد ${daysToDue} أيام`,
            daysToDue,
            contractId: contract._id,
            paymentId:  payment._id,
            propertyName: propName,
            apartmentNumber: aptNum,
            tenantName: tenant,
            amount: payment.amount,
            date: dueDate,
            createdAt: new Date()
          });
        }
      });
    });

    // ── Sort: critical first, then by date ───────────────────────────────────
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    notifications.sort((a, b) => {
      const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pd !== 0) return pd;
      return new Date(a.date) - new Date(b.date);
    });

    // ── Counts by priority ───────────────────────────────────────────────────
    const counts = {
      total:    notifications.length,
      critical: notifications.filter(n => n.priority === 'critical').length,
      high:     notifications.filter(n => n.priority === 'high').length,
      medium:   notifications.filter(n => n.priority === 'medium').length,
      low:      notifications.filter(n => n.priority === 'low').length,
    };

    res.json({ success: true, data: notifications, counts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
