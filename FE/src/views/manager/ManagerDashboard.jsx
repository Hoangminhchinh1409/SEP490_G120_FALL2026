"use client";
import React from 'react';
import { Card, Row, Col, Statistic, Table, Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { Truck, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';

export default function ManagerDashboard() {
  const incidentData = [
    { key: '1', type: 'Hỏng xe', count: 12, trend: 'up' },
    { key: '2', type: 'Tai nạn', count: 2, trend: 'down' },
    { key: '3', type: 'Hàng hóa hư hỏng', count: 5, trend: 'up' },
    { key: '4', type: 'Chậm tiến độ', count: 18, trend: 'down' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Bảng Điều khiển Hiệu suất</h1>
        <p className="text-gray-500">Báo cáo phân tích trực quan về doanh thu, tỷ lệ sử dụng xe, và thống kê sự cố.</p>
      </div>

      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card variant="borderless" className="shadow-sm rounded-xl">
            <Statistic
              title="Doanh thu (Tháng này)"
              value={1250000000}
              precision={0}
              styles={{ content: { color: '#3f8600' } }}
              prefix={<DollarSign size={20} />}
              suffix="VNĐ"
            />
            <div className="text-xs text-gray-500 mt-2"><ArrowUpOutlined className="text-green-500"/> 12% so với tháng trước</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" className="shadow-sm rounded-xl">
            <Statistic
              title="Tỷ lệ sử dụng xe (Truck Util.)"
              value={85.4}
              precision={1}
              styles={{ content: { color: '#0056a0' } }}
              prefix={<Truck size={20} />}
              suffix="%"
            />
            <div className="text-xs text-gray-500 mt-2"><ArrowUpOutlined className="text-green-500"/> 3.2% so với tháng trước</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" className="shadow-sm rounded-xl">
            <Statistic
              title="SLA Xử lý Đơn hàng"
              value={92.5}
              precision={1}
              styles={{ content: { color: '#cf1322' } }}
              prefix={<CheckCircle size={20} />}
              suffix="%"
            />
            <div className="text-xs text-gray-500 mt-2"><ArrowDownOutlined className="text-red-500"/> 1.5% so với tháng trước</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" className="shadow-sm rounded-xl">
            <Statistic
              title="Tổng số Sự cố"
              value={37}
              styles={{ content: { color: '#cf1322' } }}
              prefix={<AlertTriangle size={20} />}
            />
            <div className="text-xs text-gray-500 mt-2"><ArrowUpOutlined className="text-red-500"/> 5 sự cố so với tuần trước</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="Thống kê Sự cố theo Phân loại" variant="borderless" className="shadow-sm rounded-xl h-full">
            <Table 
              columns={[
                { title: 'Nguyên nhân', dataIndex: 'type', key: 'type' },
                { title: 'Số lượng', dataIndex: 'count', key: 'count' },
                { 
                  title: 'Xu hướng', 
                  dataIndex: 'trend', 
                  key: 'trend',
                  render: (val) => val === 'up' ? <Tag color="red"><ArrowUpOutlined /></Tag> : <Tag color="green"><ArrowDownOutlined /></Tag>
                }
              ]} 
              dataSource={incidentData} 
              pagination={false} 
              size="small"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Khối lượng đơn của Điều phối viên (Top 5)" variant="borderless" className="shadow-sm rounded-xl h-full">
            <div className="space-y-4">
              {[
                { name: 'Dispatcher 01 (Nguyễn Văn A)', count: 145, active: 12 },
                { name: 'Dispatcher 02 (Trần Thị B)', count: 132, active: 8 },
                { name: 'Dispatcher 03 (Lê Văn C)', count: 98, active: 15 },
              ].map((d, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="font-medium">{d.name}</span>
                  <div className="flex gap-4">
                    <span className="text-gray-500">Tổng: {d.count}</span>
                    <span className="text-blue-600 font-bold">Đang xử lý: {d.active}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
