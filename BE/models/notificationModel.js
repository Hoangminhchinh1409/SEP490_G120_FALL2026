const supabase = require("../config/supabase");

// ==========================================
// NOTIFICATIONS (Screen 6.5, MSG80, MSG85, MSG75)
// ==========================================

const getDriverNotifications = async (userAccountId) => {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, user_account_id, target_type, target_id, message, created_time, read_time",
    )
    .eq("user_account_id", userAccountId)
    .order("id", { ascending: false })
    .limit(50);

  if (error) {
    console.error("getDriverNotifications error:", error);
    throw error;
  }
  return data || [];
};

const markNotificationAsRead = async (notificationId, userAccountId) => {
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_time: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_account_id", userAccountId)
    .select();

  if (error) {
    console.error("markNotificationAsRead error:", error);
    throw error;
  }
  return data && data.length > 0 ? data[0] : null;
};

const markAllNotificationsAsRead = async (userAccountId) => {
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_time: new Date().toISOString() })
    .eq("user_account_id", userAccountId)
    .is("read_time", null)
    .select();

  if (error) {
    console.error("markAllNotificationsAsRead error:", error);
    throw error;
  }
  return data || [];
};

const createSystemNotification = async ({
  userAccountId,
  targetType = "TRIP",
  targetId = null,
  message,
}) => {
  try {
    const { data } = await supabase
      .from("notifications")
      .insert([
        {
          user_account_id: userAccountId,
          target_type: targetType,
          target_id: targetId,
          message,
          created_time: new Date().toISOString(),
        },
      ])
      .select();
    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.warn("createSystemNotification warning:", err.message);
    return null;
  }
};

module.exports = {
  getDriverNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createSystemNotification,
};

