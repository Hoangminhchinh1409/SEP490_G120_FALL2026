const prisma = require('../config/prisma');

const toPlainNumber = (val) => (val !== null && val !== undefined ? Number(val) : null);

const mapNotification = (n) => {
  if (!n) return null;
  return {
    ...n,
    id: toPlainNumber(n.id),
    user_account_id: toPlainNumber(n.user_account_id),
    target_id: toPlainNumber(n.target_id)
  };
};

const getDriverNotifications = async (userAccountId) => {
  const accountId = BigInt(userAccountId);
  const rows = await prisma.notifications.findMany({
    where: { user_account_id: accountId },
    orderBy: { id: 'desc' },
    take: 50
  });
  return rows.map(mapNotification);
};

const markNotificationAsRead = async (notificationId, userAccountId) => {
  const notifId = BigInt(notificationId);
  const accountId = BigInt(userAccountId);
  const updated = await prisma.notifications.updateMany({
    where: {
      id: notifId,
      user_account_id: accountId
    },
    data: {
      read_time: new Date()
    }
  });

  if (updated.count === 0) return null;
  const current = await prisma.notifications.findUnique({
    where: { id: notifId }
  });
  return mapNotification(current);
};

const markAllNotificationsAsRead = async (userAccountId) => {
  const accountId = BigInt(userAccountId);
  const updated = await prisma.notifications.updateMany({
    where: {
      user_account_id: accountId,
      read_time: null
    },
    data: {
      read_time: new Date()
    }
  });
  return updated.count;
};

const createNotification = async (notificationData) => {
  const data = {
    ...notificationData,
    user_account_id: BigInt(notificationData.user_account_id),
    target_id: notificationData.target_id ? BigInt(notificationData.target_id) : null
  };
  delete data.id;
  const created = await prisma.notifications.create({
    data
  });
  return mapNotification(created);
};

module.exports = {
  getDriverNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotification
};
