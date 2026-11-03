import React from 'react';
import { Form, Input, Select, Checkbox } from 'antd';

const { Option } = Select;

export default function OrderFormCustomerSection({ form, shippingDirection }) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
          1. Thông tin khách hàng &amp; Tiếp nhận
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 mb-4">
        <Form.Item label="Nguồn tiếp nhận" name="source" className="mb-2">
          <Select>
            <Option value="HOTLINE">Hotline / Cuộc gọi</Option>
            <Option value="ZALO">Zalo / Tin nhắn</Option>
            <Option value="DIRECT">Trực tiếp tại văn phòng</Option>
          </Select>
        </Form.Item>
        
        <Form.Item label="Mã số thuế" name="customer_tax_code" className="mb-2">
          <Input placeholder="Mã số thuế" />
        </Form.Item>

        <Form.Item label="Khách hàng" name="customer_name" rules={[{ required: true, message: 'Nhập tên khách hàng' }]} className="mb-2">
          <Input placeholder="Tên công ty hoặc doanh nghiệp" />
        </Form.Item>

        <Form.Item label="Số điện thoại" name="customer_phone" rules={[{ required: true, message: 'Nhập SĐT' }]} className="mb-2">
          <Input placeholder="Số điện thoại liên hệ" />
        </Form.Item>

        <Form.Item label="Email" name="customer_email" rules={[{ required: true, type: 'email', message: 'Email hợp lệ' }]} className="mb-2">
          <Input placeholder="Email liên hệ" />
        </Form.Item>

        <Form.Item label="Địa chỉ" name="customer_address" className="sm:col-span-2 lg:col-span-3 mb-2">
          <Input 
            placeholder="Địa chỉ trụ sở hoặc văn phòng của khách hàng" 
            onChange={(e) => {
              const val = e.target.value;
              if (form.getFieldValue('address_same_as_customer')) {
                if (shippingDirection === 'IMPORT') form.setFieldsValue({ delivery_address: val });
                else form.setFieldsValue({ pickup_address: val });
              }
            }}
          />
        </Form.Item>

        <div className="sm:col-span-2 lg:col-span-3 flex items-center -mt-1 mb-1">
          <Form.Item name="is_new_customer" valuePropName="checked" className="mb-0">
            <Checkbox className="text-xs font-semibold text-indigo-600">Khách hàng mới</Checkbox>
          </Form.Item>
        </div>
      </div>
    </>
  );
}

