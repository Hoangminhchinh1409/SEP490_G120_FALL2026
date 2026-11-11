const supabase = require('../config/supabase');

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
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_account_id', userAccountId)
    .order('id', { ascending: false })
    .limit(50);

  if (error) {
    console.error('getDriverNotifications error:', error);
    throw error;
  }
  return (data || []).map(mapNotification);
};

const markNotificationAsRead = async (notificationId, userAccountId) => {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_time: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_account_id', userAccountId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('markNotificationAsRead error:', error);
    throw error;
  }
  return mapNotification(data);
};

const markAllNotificationsAsRead = async (userAccountId) => {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_time: new Date().toISOString() })
    .eq('user_account_id', userAccountId)
    .is('read_time', null)
    .select('id');

  if (error) {
    console.error('markAllNotificationsAsRead error:', error);
    throw error;
  }
  return data ? data.length : 0;
};

const createNotification = async (notificationData) => {
  const payload = {
    user_account_id: notificationData.user_account_id,
    target_type: notificationData.target_type || null,
    target_id: notificationData.target_id || null,
    message: notificationData.message,
    created_time: notificationData.created_time || new Date().toISOString(),
    read_time: null
  };

  const { data, error } = await supabase
    .from('notifications')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('createNotification error:', error);
    throw error;
  }
  return mapNotification(data);
};

const hasNotificationWithText = async (userAccountId, textSubstring) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_account_id', userAccountId)
    .ilike('message', `%${textSubstring}%`)
    .limit(1);

  if (error) {
    console.error('hasNotificationWithText error:', error);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
};

const createSystemNotification = async ({
  userAccountId,
  user_account_id,
  targetType,
  target_type,
  targetId,
  target_id,
  message,
} = {}) => {
  return createNotification({
    user_account_id: userAccountId ?? user_account_id,
    target_type: targetType ?? target_type ?? null,
    target_id: targetId ?? target_id ?? null,
    message,
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
