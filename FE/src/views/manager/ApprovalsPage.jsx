"use client";
import React, { useState } from 'react';
import { Table, Tag, Button, Modal, Form, Input, message } from 'antd';
import { ShieldAlert, Check, X } from 'lucide-react';

const { TextArea } = Input;

export default function ApprovalsPage() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [form] = Form.useForm();
  const [actionType, setActionType] = useState(''); // 'Approve' or 'Reject'

  const incidents = [
    { id: 'INC-001', tripId: 'TRIP-998', type: 'Hàng hóa bị ướt', cost: '5,000,000 VNĐ', status: 'Chờ phê duyệt', fault: 'Chưa phân định' },
    { id: 'INC-002', tripId: 'TRIP-905', type: 'Tai nạn giao thông', cost: '12,000,000 VNĐ', status: 'Đã phê duyệt', fault: 'ALS (Tài xế)' },
  ];

  const handleAction = (record, type) => {
    setSelectedIncident(record);
    setActionType(type);
    setIsModalVisible(true);
  };

  const submitApproval = () => {
    form.validateFields().then(values => {
      message.success(`Đã ${actionType === 'Approve' ? 'phê duyệt' : 'từ chối'} đền bù cho sự cố ${selectedIncident.id}`);
      setIsModalVisible(false);
    });
  };

  const columns = [
    { title: 'Mã Sự cố', dataIndex: 'id', key: 'id', render: t => <span className="font-semibold text-red-600">{t}</span> },
    { title: 'Chuyến xe', dataIndex: 'tripId', key: 'tripId' },
    { title: 'Loại sự cố', dataIndex: 'type', key: 'type' },
    { title: 'Mức bồi thường', dataIndex: 'cost', key: 'cost' },
    { title: 'Phân định lỗi', dataIndex: 'fault', key: 'fault' },
    { 
      title: 'Trạng thái', 
      dataIndex: 'status', 
      key: 'status',
      render: status => <Tag color={status === 'Đã phê duyệt' ? 'success' : 'warning'}>{status}</Tag>
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, record) => (
        record.status === 'Chờ phê duyệt' ? (
          <div className="flex gap-2">
            <Button size="small" type="primary" className="bg-green-600" icon={<Check size={14}/>} onClick={() => handleAction(record, 'Approve')}>Duyệt</Button>
            <Button size="small" type="primary" danger icon={<X size={14}/>} onClick={() => handleAction(record, 'Reject')}>Từ chối</Button>
          </div>
        ) : (
          <Button size="small" type="link">Xem chi tiết</Button>
        )
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ShieldAlert className="text-red-500" />
          Phê duyệt Sự cố & Đền bù
        </h1>
        <p className="text-gray-500">Tiếp nhận sự cố nghiêm trọng, phân định lỗi và phê duyệt/từ chối yêu cầu bồi thường.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <Table columns={columns} dataSource={incidents} rowKey="id" pagination={false} />
      </div>

      <Modal 
        title={actionType === 'Approve' ? 'Phê duyệt Bồi thường' : 'Từ chối Bồi thường'} 
        open={isModalVisible} 
        onCancel={() => setIsModalVisible(false)}
        onOk={submitApproval}
        okButtonProps={{ danger: actionType === 'Reject', className: actionType === 'Approve' ? 'bg-green-600' : '' }}
        okText={actionType === 'Approve' ? 'Xác nhận Duyệt' : 'Xác nhận Từ chối'}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <div className="p-3 bg-gray-50 rounded-lg mb-4 border border-gray-200">
            <p><strong>Mã Sự cố:</strong> {selectedIncident?.id}</p>
            <p><strong>Mức bồi thường:</strong> {selectedIncident?.cost}</p>
          </div>

          {actionType === 'Reject' && (
            <Form.Item name="reason" label="Lý do từ chối (Bắt buộc)" rules={[{ required: true, message: 'Vui lòng nhập lý do từ chối!' }]}>
              <TextArea rows={4} placeholder="Nhập lý do từ chối bồi thường..." />
            </Form.Item>
          )}

          {actionType === 'Approve' && (
            <Form.Item name="note" label="Ghi chú thêm (Tùy chọn)">
              <TextArea rows={3} placeholder="Nhập ghi chú phê duyệt..." />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
