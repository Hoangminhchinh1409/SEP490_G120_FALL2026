"use client";
import React, { Suspense } from 'react';
import OrderConfirmationView from '../../../../src/views/customer/OrderConfirmationView';
import { Spin } from 'antd';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spin size="large" /></div>}>
      <OrderConfirmationView />
    </Suspense>
  );
}
