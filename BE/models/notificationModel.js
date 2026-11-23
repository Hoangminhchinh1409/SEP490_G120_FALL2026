const prisma = require('../config/prisma');
const { serializePrisma, toBigInt, toNum } = require('../utils/prismaHelper');

const mapNotification = (n) => {
  if (!n) return null;
  const serialized = serializePrisma(n);
  return {
    ...serialized,
    id: toNum(serialized.id),
    user_account_id: toNum(serialized.user_account_id),
    target_id: toNum(serialized.target_id)
  };
};

const getDriverNotifications = async (userAccountId) => {
  const rows = await prisma.notifications.findMany({
    where: { user_account_id: toBigInt(userAccountId) },
    orderBy: { id: 'desc' },
    take: 50
  });
  return (rows || []).map(mapNotification);
};

const markNotificationAsRead = async (notificationId, userAccountId) => {
  const notifId = toBigInt(notificationId);
  const userId = toBigInt(userAccountId);
  const existing = await prisma.notifications.findFirst({
    where: { id: notifId, user_account_id: userId }
  });
  if (!existing) return null;

  const updated = await prisma.notifications.update({
    where: { id: notifId },
    data: { read_time: new Date() }
  });
  return mapNotification(updated);
};

const markAllNotificationsAsRead = async (userAccountId) => {
  const result = await prisma.notifications.updateMany({
    where: {
      user_account_id: toBigInt(userAccountId),
      read_time: null
    },
    data: { read_time: new Date() }
  });
  return result.count || 0;
};

const createNotification = async (notificationData) => {
  const created = await prisma.notifications.create({
    data: {
      user_account_id: toBigInt(notificationData.user_account_id),
      target_type: notificationData.target_type || null,
      target_id: toBigInt(notificationData.target_id),
      message: notificationData.message,
      created_time: notificationData.created_time ? new Date(notificationData.created_time) : new Date(),
      read_time: null
    }
  });
  return mapNotification(created);
};

const hasNotificationWithText = async (userAccountId, textSubstring) => {
  try {
    const match = await prisma.notifications.findFirst({
      where: {
        user_account_id: toBigInt(userAccountId),
        message: { contains: textSubstring, mode: 'insensitive' }
      },
      select: { id: true }
    });
    return Boolean(match);
  } catch (error) {
    console.error('hasNotificationWithText error:', error);
    return false;
  }
};

const createSystemNotification = async ({
  userAccountId,
  user_account_id,
  targetType,
  target_type,
  targetId,
  target_id,
  message
} = {}) => {
  return createNotification({
    user_account_id: userAccountId ?? user_account_id,
    target_type: targetType ?? target_type ?? null,
    target_id: targetId ?? target_id ?? null,
    message
  });
};

module.exports = {
  getDriverNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotification,
  createSystemNotification,
  hasNotificationWithText
};
