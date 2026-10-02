"use client";
import React, { useState } from 'react';
import { Table, Tag, Button, Modal, Form, Select, message, Badge } from 'antd';
import { Repeat } from 'lucide-react';

export default function OrdersWorkloadPage() {
  const [isReassignModalVisible, setIsReassignModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [form] = Form.useForm();

  const orders = [
    { id: 'ALS260930-0001', dispatcher: 'dispatcher01', status: 'Ready for Planning', timeInStatus: '45 phút (Quá hạn!)' },
    { id: 'ALS260930-0002', dispatcher: 'dispatcher02', status: 'Ready for Planning', timeInStatus: '10 phút' },
    { id: 'ALS260930-0003', dispatcher: 'dispatcher01', status: 'Waiting for Documents', timeInStatus: '2 giờ' },
  ];

  const handleReassign = (record) => {
    setSelectedOrder(record);
    setIsReassignModalVisible(true);
  };

  const submitReassign = () => {
    form.validateFields().then(values => {
      message.success(`Đã chuyển giao đơn ${selectedOrder.id} sang ${values.newDispatcher}`);
      setIsReassignModalVisible(false);
    });
  };

  const columns = [
    { title: 'Mã đơn hàng', dataIndex: 'id', key: 'id', render: text => <span className="font-semibold text-[#0056a0]">{text}</span> },
    { title: 'Người phụ trách', dataIndex: 'dispatcher', key: 'dispatcher' },
    { 
      title: 'Trạng thái', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => <Tag color={status.includes('Ready') ? 'processing' : 'warning'}>{status}</Tag>
    },
    { 
      title: 'Thời gian tại trạng thái', 
      dataIndex: 'timeInStatus', 
      key: 'timeInStatus',
      render: (time) => (
        <span className={time.includes('Quá hạn') ? 'text-red-500 font-bold' : ''}>
          {time.includes('Quá hạn') && <Badge status="error" className="mr-2" />}
          {time}
        </span>
      )
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="primary" 
          ghost 
          size="small" 
          icon={<Repeat size={14} />} 
          onClick={() => handleReassign(record)}
        >
          Chuyển giao (Reassign)
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Giám sát & Điều chuyển Đơn hàng</h1>
        <p className="text-gray-500">Đo lường khối lượng đơn của Điều phối viên và can thiệp giải phóng điểm nghẽn.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden p-4">
        <div className="mb-4 text-red-500 font-semibold bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2">
          <Badge status="error" /> Cảnh báo: Có 1 đơn hàng bị nghẽn ở trạng thái &quot;Ready for Planning&quot; quá thời gian quy định!
        </div>
        
        <Table columns={columns} dataSource={orders} rowKey="id" pagination={false} />
      </div>

      <Modal 
        title="Chuyển giao Đơn hàng (Reassign Order)" 
        open={isReassignModalVisible} 
        onCancel={() => setIsReassignModalVisible(false)}
        onOk={submitReassign}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <p className="mb-4">Bạn đang chuyển giao đơn hàng <b>{selectedOrder?.id}</b> từ <b>{selectedOrder?.dispatcher}</b> sang Điều phối viên khác.</p>
          <Form.Item name="newDispatcher" label="Chọn Điều phối viên mới" rules={[{ required: true }]}>
            <Select options={[
              { value: 'dispatcher02', label: 'Dispatcher 02 (Đang xử lý: 8 đơn)' },
              { value: 'dispatcher03', label: 'Dispatcher 03 (Đang xử lý: 15 đơn)' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
