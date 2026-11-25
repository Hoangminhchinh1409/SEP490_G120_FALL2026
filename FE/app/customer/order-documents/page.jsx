"use client";
import React, { Suspense } from 'react';
import OrderDocumentsView from '../../../src/views/customer/OrderDocumentsView';
import { Spin } from 'antd';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spin size="large" /></div>}>
      <OrderDocumentsView />
    </Suspense>
  );
}
