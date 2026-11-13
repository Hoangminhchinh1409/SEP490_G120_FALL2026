"use client";
import React from "react";
import DriverShiftsPage from "../../../src/views/manager/DriverShiftsPage";
import { useAuth } from "../../../src/providers/AuthProvider";
import AccessDenied from "../../../src/components/common/AccessDenied";

export default function ShiftsPage() {
  const { user, hasPermission } = useAuth();
  const roleId = Number(user?.role_id);
  const isDispatcher = roleId === 3;
  const hasAccess = roleId === 1 || roleId === 2 || (hasPermission && hasPermission('DRIVER_SHIFT_MANAGE'));

  if (isDispatcher && !hasAccess) {
    return <AccessDenied moduleName="Quản lý Ca trực Tài xế (DRIVER_SHIFT_MANAGE)" />;
  }

  return <DriverShiftsPage />;
}
