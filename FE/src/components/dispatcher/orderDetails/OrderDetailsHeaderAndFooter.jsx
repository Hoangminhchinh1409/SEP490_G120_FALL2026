'use client';
import React from 'react';
import { Tag, Button, message } from 'antd';
import { ArrowUpRight, ExternalLink } from 'lucide-react';

export function OrderDetailsModalTitle({ order, hasRejectedDocs, isDocsApprovedStage }) {
  return (
    <div className="flex items-center justify-between pb-3 border-b border-gray-100 pr-8">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-50 text-[#7367f0] rounded-xl font-bold font-mono">
          {order.order_id}
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-800">Hồ sơ Chi tiết Đơn hàng</h3>
          <p className="text-[11px] text-gray-400 m-0">
            Khách hàng: <b>{order.customer}</b>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {order.source === 'HOMEPAGE' ? (
          <Tag color="orange" className="font-semibold text-xs rounded-full px-3 py-0.5">
            Nguồn: Website
          </Tag>
        ) : (
          <Tag color="blue" className="font-semibold text-xs rounded-full px-3 py-0.5">
            Nguồn: Hotline / Trực tiếp
          </Tag>
        )}
        <Tag
          color={
            order.status === 'DELIVERED'
              ? 'green'
              : order.status === 'DELIVERED_EXCEPTION'
                ? 'error'
                : order.status === 'HANDED_OVER_VENDOR'
                  ? 'volcano'
                  : order.status === 'IN_TRANSIT'
                    ? 'purple'
                    : order.status === 'PICKED_UP'
                      ? 'gold'
                      : order.status === 'ACCEPTED'
                        ? 'geekblue'
                        : order.status === 'ASSIGNED'
                          ? 'orange'
                          : order.status === 'CANCELLED'
                            ? 'red'
                            : order.status === 'READY_FOR_PLANNING'
                              ? 'cyan'
                              : hasRejectedDocs || order.web_workflow?.stage === 'DOCS_REJECTED'
                                ? 'error'
                                : isDocsApprovedStage
                                  ? 'success'
                                  : order.status === 'CONFIRMED'
                                    ? 'blue'
                                    : 'default'
          }
          className="px-3 py-1 font-semibold text-xs rounded-full"
        >
          {order.status === 'DRAFT'
            ? 'ĐƠN NHÁP'
            : order.status === 'READY_FOR_PLANNING'
              ? 'SẴN SÀNG XẾP XE'
              : order.status === 'ASSIGNED'
                ? 'ĐÃ GÁN XE'
                : order.status === 'ACCEPTED'
                  ? 'TÀI XẾ ĐÃ NHẬN'
                  : order.status === 'PICKED_UP'
                    ? 'ĐÃ LẤY HÀNG'
                    : order.status === 'IN_TRANSIT'
                      ? 'ĐANG VẬN CHUYỂN'
                      : order.status === 'HANDED_OVER_VENDOR'
                        ? 'GIAO NHÀ XE NGOÀI'
                        : order.status === 'DELIVERED'
                          ? 'ĐÃ GIAO HÀNG'
                          : order.status === 'DELIVERED_EXCEPTION'
                            ? 'TỪ CHỐI NHẬN HÀNG'
                            : order.status === 'CANCELLED'
                              ? 'ĐÃ HỦY'
                              : order.status === 'CLOSED'
                                ? 'ĐÃ ĐÓNG'
                                : hasRejectedDocs || order.web_workflow?.stage === 'DOCS_REJECTED'
                                  ? 'CHỜ KHÁCH UPLOAD LẠI CHỨNG TỪ'
                                  : isDocsApprovedStage
                                    ? 'ĐÃ DUYỆT CHỨNG TỪ - CHỜ ĐÍNH KÈM HỢP ĐỒNG PDF'
                                    : order.status === 'CONFIRMED'
                                      ? 'CẦN XÁC NHẬN CHỨNG TỪ'
                                      : order.status}
        </Tag>
        {(order.tracking_token || order.order_id || order.order_code) && (
          <Button
            size="small"
            icon={<ExternalLink size={12} />}
            onClick={() => {
              const token = order.tracking_token || order.order_id || order.order_code;
              const url = `${window.location.origin}/customer/order-confirmation/${token}`;
              if (navigator.clipboard) {
                navigator.clipboard.writeText(url);
                message.success('Đã sao chép link xác nhận đơn của khách hàng!');
              }
              window.open(url, '_blank');
            }}
            className="text-xs font-medium border-indigo-200 text-indigo-600 hover:text-indigo-700 hover:border-indigo-400"
          >
            Mở trang khách
          </Button>
        )}
      </div>
    </div>
  );
}

export function getOrderDetailsModalFooter({
  order,
  isClosed,
  readOnly,
  onCancel,
  savingPrice,
  handleConfirmPriceAndOrder,
  isDocsApprovedStage,
  confirmingDocs,
  hasRejectedDocs,
  handleConfirmAllDocuments,
  contractUploaded,
  uploadingContract,
  onClickUploadScannedContract,
  onClickPlanTrip,
  onClickCancelOrder
}) {
  if (isClosed || readOnly) {
    return [
      <Button key="close" type="primary" onClick={onCancel}>
        Đóng
      </Button>
    ];
  }

  return [
    <Button key="close" onClick={onCancel}>
      Đóng
    </Button>,
    order.status === 'DRAFT' && (
      <Button
        key="confirmPrice"
        type="primary"
        loading={savingPrice}
        className="bg-indigo-600 hover:bg-indigo-700 font-semibold"
        onClick={handleConfirmPriceAndOrder}
      >
        Chốt giá &amp; Xác nhận đơn
      </Button>
    ),
    order.status === 'CONFIRMED' && !isDocsApprovedStage && (
      <Button
        key="confirmDocs"
        type="primary"
        loading={confirmingDocs}
        disabled={hasRejectedDocs}
        className={
          hasRejectedDocs
            ? 'font-semibold'
            : 'bg-emerald-600 hover:bg-emerald-700 font-semibold'
        }
        onClick={handleConfirmAllDocuments}
      >
        {hasRejectedDocs
          ? 'Chờ khách tải lại chứng từ bị từ chối'
          : order.source === 'HOMEPAGE'
            ? 'Duyệt chứng từ & Chuyển sang đính kèm Hợp đồng PDF'
            : 'Xác nhận chứng từ & Chuyển sang Hợp đồng PDF'}
      </Button>
    ),
    order.status === 'CONFIRMED' && isDocsApprovedStage && !contractUploaded && (
      <Button
        key="uploadScannedContract"
        type="primary"
        loading={uploadingContract}
        className="bg-indigo-600 hover:bg-indigo-700 font-semibold"
        onClick={onClickUploadScannedContract}
      >
        Đính kèm hợp đồng đã scan (PDF)
      </Button>
    ),
    order.status === 'READY_FOR_PLANNING' && (
      <Button
        key="planTrip"
        type="primary"
        icon={<ArrowUpRight size={14} />}
        className="bg-[#7367f0] hover:bg-[#5e50ee] font-semibold"
        onClick={onClickPlanTrip}
      >
        Chuyển sang Xếp chuyến &amp; Điều xe
      </Button>
    ),
    ['DRAFT', 'CONFIRMED', 'READY_FOR_PLANNING', 'ASSIGNED', 'ACCEPTED'].includes(order.status) && (
      <Button key="cancel" danger onClick={onClickCancelOrder}>
        Hủy đơn
      </Button>
    )
  ];
}
