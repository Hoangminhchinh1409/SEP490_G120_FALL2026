import React from 'react';
import { Form, InputNumber, Checkbox } from 'antd';
import { Calculator, ShieldCheck } from 'lucide-react';

export default function OrderFormPricingSection({
  customsServiceRequired,
  setCustomsServiceRequired,
  estimatedPricing,
  estimatedBaselineRate,
  routeInfo
}) {
  return (
    <>
      <div className="text-xs font-bold text-gray-600 uppercase mb-2 tracking-wider flex items-center gap-1.5">
        <Calculator size={15} className="text-indigo-600" />
        5. Dịch vụ Hải quan &amp; Cước phí vận chuyển
      </div>

      {/* Khối đăng ký làm thủ tục hải quan hộ */}
      <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 p-3 rounded-xl border border-blue-200 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-600 text-white rounded-lg">
            <ShieldCheck size={16} />
          </div>
          <span className="text-xs font-bold text-gray-800">
            Dịch vụ làm thủ tục hải quan
          </span>
          <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
            +500.000 VNĐ / tờ khai
          </span>
        </div>

        <div>
          <Checkbox
            checked={customsServiceRequired}
            onChange={(e) => setCustomsServiceRequired(e.target.checked)}
          />
        </div>
      </div>

      <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 mb-4">
        <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator size={16} className="text-indigo-600" />
            <span className="text-xs text-gray-700 font-medium">
              Cước tham chiếu ({estimatedPricing.isFixedRoute ? estimatedPricing.routeName : `${routeInfo.distanceKm} km`}):
            </span>
            {customsServiceRequired && (
              <span className="text-[11px] text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded font-medium">
                (+500.000đ hải quan)
              </span>
            )}
          </div>
          <span className="text-sm font-bold text-indigo-700">
            ~ {estimatedBaselineRate.toLocaleString()} VNĐ
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Form.Item 
            label="Giá cước thỏa thuận (VNĐ)" 
            name="agreed_price" 
            rules={[{ required: true, message: 'Nhập giá thỏa thuận' }]} 
            className="mb-0"
          >
            <InputNumber 
              className="w-full font-bold text-blue-700"
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')} 
              min={0} 
            />
          </Form.Item>

          <Form.Item label="Phí phụ trội (VNĐ)" name="extra_fees_surcharge" className="mb-0">
            <InputNumber 
              className="w-full text-indigo-700"
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')} 
              min={0} 
            />
          </Form.Item>

          <Form.Item label="Phí phát sinh (VNĐ)" name="extra_fees_collection" className="mb-0">
            <InputNumber 
              className="w-full text-emerald-700"
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')} 
              min={0} 
            />
          </Form.Item>
        </div>
      </div>
    </>
  );
}

