import React from 'react';
import { Button, Tag, Select, Input } from 'antd';
import { FileText, Sparkles, FileCheck2, UploadCloud, Trash2, Plus } from 'lucide-react';
import { SPECIALIZED_CARGO_CATEGORIES } from '../../../data/dispatcherPresets';

export default function OrderFormDocumentsSection({
  documents,
  handleTriggerAiSuggestDocs,
  triggerUploadDoc,
  handleDeleteDirectDoc,
  selectedSpecializedDoc,
  setSelectedSpecializedDoc,
  newCustomDocName,
  setNewCustomDocName,
  handleAddDirectCustomDoc
}) {
  return (
    <div className="bg-white p-3.5 rounded-xl border border-indigo-100 mb-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-50 pb-2.5 mb-3">
        <div>
          <div className="text-xs font-bold text-gray-800 uppercase flex items-center gap-1.5">
            <FileText size={15} className="text-indigo-600" />
            <span>6. HỒ SƠ CHỨNG TỪ ĐÍNH KÈM (KHÁCH GỬI QUA ZALO / GỌI ĐIỆN)</span>
          </div>
          <p className="text-[11px] text-gray-500 m-0 mt-0.5">
            Đính kèm ngay các chứng từ khách đã gửi qua Zalo/email để đơn chốt hoàn tất và sẵn sàng xếp xe.
          </p>
        </div>

        <Button
          size="small"
          icon={<Sparkles size={13} className="text-purple-600" />}
          className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 font-semibold text-xs flex items-center self-start sm:self-auto"
          onClick={handleTriggerAiSuggestDocs}
        >
          Trợ lý AI gợi ý
        </Button>
      </div>

      <div className="space-y-2">
        {documents.map((doc, idx) => (
          <div key={doc.key || idx} className="p-2.5 rounded-lg bg-gray-50/80 border border-gray-150 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                {idx + 1}
              </span>
              <div className="truncate">
                <span className="font-semibold text-gray-800 text-xs block truncate" title={doc.name}>
                  {doc.name}
                </span>
                <span className="text-[11px] text-gray-500 block truncate">
                  {doc.description}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {doc.file && doc.file !== 'Chờ tải lên' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  <FileCheck2 size={12} /> {doc.file} ({doc.size})
                </span>
              ) : (
                <Tag color="default" className="text-[10px] m-0">Chưa tải lên</Tag>
              )}

              <Button
                size="small"
                icon={<UploadCloud size={13} />}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 border-indigo-200"
                onClick={() => triggerUploadDoc(doc.key)}
              >
                {doc.file && doc.file !== 'Chờ tải lên' ? 'Tải lại' : 'Tải lên'}
              </Button>

              {doc.isCustom && (
                <Button
                  size="small"
                  danger
                  type="text"
                  icon={<Trash2 size={13} />}
                  onClick={() => handleDeleteDirectDoc(doc.key)}
                  title="Xóa chứng từ này"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Hàng công cụ bổ sung thêm chứng từ khác */}
      <div className="mt-3 pt-3 border-t border-gray-150">
        <div className="text-[11px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
          <Plus size={13} className="text-indigo-600" /> Bổ sung thêm loại chứng từ khác:
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-6">
            <Select
              placeholder="-- Chọn chứng từ chuyên ngành có sẵn --"
              value={selectedSpecializedDoc || undefined}
              onChange={val => {
                setSelectedSpecializedDoc(val);
                setNewCustomDocName('');
              }}
              allowClear
              className="w-full text-xs"
            >
              {SPECIALIZED_CARGO_CATEGORIES.map(cat => (
                <Select.OptGroup key={cat.categoryKey} label={cat.categoryName}>
                  {cat.specializedDocs.map(d => (
                    <Select.Option key={d.name} value={d.name}>
                      {d.name}
                    </Select.Option>
                  ))}
                </Select.OptGroup>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-4">
            <Input
              placeholder="Hoặc tự gõ tên chứng từ khác..."
              value={newCustomDocName}
              onChange={e => {
                setNewCustomDocName(e.target.value);
                setSelectedSpecializedDoc('');
              }}
              className="text-xs"
            />
          </div>

          <div className="sm:col-span-2">
            <Button
              type="primary"
              icon={<Plus size={13} />}
              className="w-full bg-[#7367f0] hover:bg-[#5e50ee] text-xs font-semibold"
              onClick={handleAddDirectCustomDoc}
            >
              Thêm
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

