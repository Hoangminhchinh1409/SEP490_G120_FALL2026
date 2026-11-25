'use client';
import { useState, useRef, useEffect } from 'react';
import { message } from 'antd';
import {
  SPECIALIZED_CARGO_CATEGORIES,
  getRecommendedDocsByCargo
} from '../../../data/dispatcherPresets';
import { orderApi } from '../../../api/orderApi';
import { uploadApi } from '../../../api/uploadApi';

export function useOrderDocumentActions({ order, onUpdateOrder, currentAgreedPrice }) {
  const [confirmingDocs, setConfirmingDocs] = useState(false);

  // State Modal Từ chối 1 chứng từ
  const [rejectDocModalOpen, setRejectDocModalOpen] = useState(false);
  const [rejectingDocKey, setRejectingDocKey] = useState(null);
  const [rejectDocReason, setRejectDocReason] = useState(
    'Chứng từ chưa hợp lệ hoặc bị mờ, vui lòng tải lại tệp đúng quy định.'
  );
  const [submittingRejectDoc, setSubmittingRejectDoc] = useState(false);

  // State Hợp đồng scan
  const [contractUploaded, setContractUploaded] = useState(order.contract_uploaded || false);
  const [, setContractFile] = useState(order.contract_file || null);
  const [, setContractFileData] = useState(order.contract_file_data || null);
  const [, setContractUploadedAt] = useState(order.contract_uploaded_at || null);
  const [uploadingContract, setUploadingContract] = useState(false);

  // State Chứng từ vận tải
  const [documents, setDocuments] = useState(() => {
    if (Array.isArray(order.documents) && order.documents.length > 0) {
      return order.documents;
    }
    return getRecommendedDocsByCargo(
      order.cargo_name || order.cargo_type || '',
      order.cargo_type || '',
      order.order_notes || ''
    );
  });

  // Đồng bộ danh sách chứng từ khi khách hàng tải lại tệp từ trang Web
  useEffect(() => {
    if (Array.isArray(order.documents) && order.documents.length > 0) {
      setDocuments(order.documents);
    }
  }, [order.documents, order.web_workflow?.docs_uploaded_at]);

  const [newDocName, setNewDocName] = useState('');
  const [selectedSpecializedDoc, setSelectedSpecializedDoc] = useState('');
  const [uploadingDocKey, setUploadingDocKey] = useState(null);
  const fileInputRef = useRef(null);
  const contractInputRef = useRef(null);

  const hasRejectedDocs = documents.some((d) => d.status === 'REJECTED');
  const isDocsApprovedStage =
    !hasRejectedDocs &&
    (order.web_workflow?.stage === 'DOCS_APPROVED' ||
      order.web_workflow?.stage === 'CONTRACT_SIGNED');

  // 2. Xử lý Tải lên chứng từ
  const triggerUploadDoc = (docKey) => {
    setUploadingDocKey(docKey);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingDocKey) return;

    const sizeFormatted =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    const nowFormatted = new Date().toLocaleDateString('vi-VN');
    const orderId = order.id || order.order_id;
    const currentDocKey = uploadingDocKey;

    try {
      const uploaded = await uploadApi.uploadToCloudinary(file, `nexlog/orders/${orderId}/docs`);
      const updatedDocs = documents.map((d) => {
        if (d.key === currentDocKey) {
          return {
            ...d,
            file: file.name,
            file_url: uploaded.url,
            file_data: uploaded.url,
            size: sizeFormatted,
            uploadDate: nowFormatted,
            status: 'PENDING_REVIEW',
            reject_reason: null
          };
        }
        return d;
      });

      setDocuments(updatedDocs);
      setUploadingDocKey(null);

      await orderApi.uploadOrderDocuments(orderId, updatedDocs);
      onUpdateOrder?.({
        ...order,
        documents: updatedDocs,
        web_workflow: {
          ...(order.web_workflow || {}),
          documents: updatedDocs
        }
      });
      message.success(`Đã tải lên Cloudinary và lưu tệp chứng từ: ${file.name}`);
    } catch (err) {
      console.error('Lỗi tải/lưu chứng từ:', err);
      message.error(err.message || `Không thể tải tệp ${file.name} lên Cloudinary.`);
      setUploadingDocKey(null);
    }
  };

  // 2b. Xử lý Tải lên tệp hợp đồng
  const handleContractFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      message.error('Tệp hợp đồng tải lên bắt buộc phải là định dạng PDF (.pdf)!');
      if (contractInputRef.current) contractInputRef.current.value = '';
      return;
    }

    const sizeFormatted =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    try {
      setUploadingContract(true);
      const orderId = order.id || order.order_id;
      const uploaded = await uploadApi.uploadToCloudinary(file, `nexlog/orders/${orderId}/contract`);
      const contractUrl = uploaded.url;

      const res = await orderApi.uploadContractFile(orderId, {
        file_name: file.name,
        file_data: contractUrl,
        file_url: contractUrl,
        file_size: sizeFormatted
      });

      setContractUploaded(true);
      setContractFile(file.name);
      setContractFileData(contractUrl);
      setContractUploadedAt(res.contract_uploaded_at || new Date().toISOString());

      const nextStatus =
        res?.order?.status || (isDocsApprovedStage ? 'READY_FOR_PLANNING' : order.status);
      const updatedOrder = {
        ...order,
        status: nextStatus,
        contract_uploaded: true,
        contract_file: file.name,
        contract_file_data: contractUrl,
        contract_uploaded_at: res.contract_uploaded_at || new Date().toISOString(),
        web_workflow: res?.web_workflow || {
          ...(order.web_workflow || {}),
          stage: 'CONTRACT_SIGNED',
          signed_contract: {
            signed_at: res.contract_uploaded_at || new Date().toISOString(),
            signer_name: 'Hai bên ký trực tiếp (Bản Scan PDF)',
            contract_file: file.name
          }
        }
      };

      onUpdateOrder?.(updatedOrder);
      message.success(
        res?.message ||
          `Đã đính kèm bản scan hợp đồng [${file.name}] vào hồ sơ đơn hàng thành công!`
      );
    } catch (err) {
      console.error('Upload contract api error:', err);
      message.error(err.message || 'Lỗi khi tải tệp hợp đồng lên Cloudinary');
    } finally {
      setUploadingContract(false);
    }
  };

  // 3. Duyệt và Từ chối từng chứng từ
  const handleApproveDoc = async (docKey) => {
    const updated = documents.map((d) =>
      d.key === docKey ? { ...d, status: 'APPROVED', reject_reason: null } : d
    );
    setDocuments(updated);

    const nonCustomsDocs = updated.filter(
      (d) =>
        !(
          d.preparedBy === 'DISPATCHER' ||
          d.key === 'doc-basic-1' ||
          d.name?.toLowerCase().includes('tờ khai hải quan')
        )
    );
    const stillHasRejected = updated.some((d) => d.status === 'REJECTED');
    const allApproved =
      nonCustomsDocs.length > 0 && nonCustomsDocs.every((d) => d.status === 'APPROVED');
    const nextStage = stillHasRejected
      ? 'DOCS_REJECTED'
      : allApproved
        ? 'DOCS_APPROVED'
        : 'DOCS_UPLOADED';

    try {
      const res = await orderApi.uploadOrderDocuments(
        order.id || order.order_id,
        updated,
        nextStage
      );
      onUpdateOrder?.({
        ...order,
        status:
          allApproved && (order.contract_uploaded || res?.order?.status === 'READY_FOR_PLANNING')
            ? 'READY_FOR_PLANNING'
            : 'CONFIRMED',
        documents: updated,
        web_workflow: res?.web_workflow || {
          ...(order.web_workflow || {}),
          stage: nextStage,
          documents: updated,
          approved_documents: allApproved
            ? updated.filter((d) => d.status === 'APPROVED')
            : order.web_workflow?.approved_documents || null
        }
      });
      message.success(
        allApproved ? 'Đã duyệt toàn bộ chứng từ thành công!' : 'Đã duyệt tính hợp lệ của chứng từ!'
      );
    } catch (e) {
      console.error('handleApproveDoc error:', e);
      onUpdateOrder?.({
        ...order,
        status: 'CONFIRMED',
        documents: updated,
        web_workflow: {
          ...(order.web_workflow || {}),
          stage: nextStage,
          documents: updated
        }
      });
      message.success('Đã duyệt tính hợp lệ của chứng từ!');
    }
  };

  const handleRejectDoc = (docKey) => {
    setRejectingDocKey(docKey);
    setRejectDocReason(
      'Chứng từ bị mờ hoặc thông tin chưa khớp, vui lòng tải lại tệp đúng quy định.'
    );
    setRejectDocModalOpen(true);
  };

  const handleConfirmRejectDoc = async () => {
    if (!rejectingDocKey) return;
    if (!rejectDocReason.trim()) {
      message.error('Vui lòng nhập lý do từ chối chứng từ để thông báo cho khách hàng!');
      return;
    }

    try {
      setSubmittingRejectDoc(true);
      const updated = documents.map((d) =>
        d.key === rejectingDocKey
          ? { ...d, status: 'REJECTED', reject_reason: rejectDocReason.trim() }
          : d
      );
      setDocuments(updated);

      const res = await orderApi.rejectOrderDocument(order.id || order.order_id, {
        doc_key: rejectingDocKey,
        reject_reason: rejectDocReason.trim(),
        documents: updated
      });

      onUpdateOrder?.({
        ...order,
        documents: res?.documents || updated,
        web_workflow: res?.web_workflow || {
          ...(order.web_workflow || {}),
          stage: 'DOCS_REJECTED',
          documents: updated
        }
      });

      setRejectDocModalOpen(false);
      setRejectingDocKey(null);
      message.warning(
        res?.message || 'Đã từ chối chứng từ và gửi email yêu cầu khách hàng tải lại tệp mới!'
      );
    } catch (err) {
      console.error('rejectOrderDocument error:', err);
      message.error(err.message || 'Lỗi khi từ chối chứng từ');
    } finally {
      setSubmittingRejectDoc(false);
    }
  };

  // 4. Bổ sung chứng từ tùy biến
  const handleAddCustomDoc = (docTitle) => {
    const title =
      typeof docTitle === 'string' && docTitle.trim()
        ? docTitle.trim()
        : (selectedSpecializedDoc || newDocName).trim();

    if (!title) {
      message.error('Vui lòng chọn hoặc nhập tên loại chứng từ cần bổ sung!');
      return;
    }

    if (documents.some((d) => d.name.toLowerCase() === title.toLowerCase())) {
      message.warning(`Chứng từ "${title}" đã có trong danh mục!`);
      return;
    }

    let docDesc = 'Chứng từ hồ sơ đối chiếu bổ sung theo yêu cầu';
    let catName = 'Chứng từ bổ sung';
    for (const cat of SPECIALIZED_CARGO_CATEGORIES) {
      const match = cat.specializedDocs.find((d) => d.name === title);
      if (match) {
        docDesc = match.description;
        catName = cat.categoryName;
        break;
      }
    }

    const slug =
      title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 24) || 'doc';
    let suffix = documents.length + 1;
    let newKey = `custom-doc-${suffix}-${slug}`;
    while (documents.some((d) => d.key === newKey)) {
      suffix += 1;
      newKey = `custom-doc-${suffix}-${slug}`;
    }
    const newDoc = {
      key: newKey,
      name: title,
      description: docDesc,
      file: 'Chờ tải lên',
      status: 'WAITING_UPLOAD',
      size: '-',
      uploadDate: '-',
      isBasic: false,
      isCustom: true,
      categoryName: catName
    };

    const updated = [...documents, newDoc];
    setDocuments(updated);
    setNewDocName('');
    setSelectedSpecializedDoc('');
    orderApi.uploadOrderDocuments(order.id || order.order_id, updated).catch(() => {});
    message.success(`Đã thêm mục chứng từ mới: "${newDoc.name}"`);
  };

  const handleApplyAssistantRecommendations = (recommendedList) => {
    const updated = recommendedList.map((rec) => {
      const exist = documents.find((p) => p.name === rec.name);
      if (exist && exist.file !== 'Chờ tải lên') {
        return {
          ...rec,
          file: exist.file,
          size: exist.size,
          uploadDate: exist.uploadDate,
          status: exist.status
        };
      }
      return rec;
    });
    setDocuments(updated);
    orderApi.uploadOrderDocuments(order.id || order.order_id, updated).catch(() => {});
    message.success('Đã cập nhật danh mục chứng từ từ Trợ lý AI!');
  };

  const handleDeleteCustomDoc = (docKey) => {
    const updated = documents.filter((d) => d.key !== docKey);
    setDocuments(updated);
    orderApi.uploadOrderDocuments(order.id || order.order_id, updated).catch(() => {});
    message.info('Đã xóa mục chứng từ.');
  };

  // 5. Xác nhận toàn bộ chứng từ
  const handleConfirmAllDocuments = async () => {
    const rejectedList = documents.filter((d) => d.status === 'REJECTED');
    if (rejectedList.length > 0) {
      message.error(
        `Không thể duyệt toàn bộ hồ sơ vì đang có ${rejectedList.length} chứng từ bị TỪ CHỐI (${rejectedList.map((d) => d.name).join(', ')}). Vui lòng chờ khách hàng tải lại tệp hợp lệ!`
      );
      return;
    }

    const unuploaded = documents.filter(
      (d) => d.file === 'Chờ tải lên' || d.status === 'WAITING_UPLOAD'
    );
    if (unuploaded.length > 0) {
      const nonCustomsUnuploaded = unuploaded.filter(
        (d) =>
          !(
            d.preparedBy === 'DISPATCHER' ||
            d.key === 'doc-basic-1' ||
            d.name?.toLowerCase().includes('tờ khai hải quan')
          )
      );
      if (nonCustomsUnuploaded.length > 0) {
        message.warning(
          `Còn ${nonCustomsUnuploaded.length} chứng từ của khách chưa được tải tệp lên! Hãy tải đầy đủ trước khi xác nhận.`
        );
        return;
      }
    }

    const isWebOrder = order.source === 'HOMEPAGE';

    try {
      setConfirmingDocs(true);
      const approvedDocs = documents.map((d) => ({
        ...d,
        status: 'APPROVED',
        reject_reason: null
      }));
      setDocuments(approvedDocs);

      if (isWebOrder) {
        const res = await orderApi.approveWebOrderDocuments(
          order.id || order.order_id,
          approvedDocs
        );

        const updatedOrder = {
          ...order,
          status: 'READY_FOR_PLANNING',
          documents: approvedDocs,
          web_workflow: res?.web_workflow || {
            ...(order.web_workflow || {}),
            stage: 'DOCS_APPROVED',
            documents: approvedDocs,
            approved_documents: approvedDocs
          }
        };

        onUpdateOrder?.(updatedOrder);
        message.success(
          res?.message || 'Đã duyệt toàn bộ hồ sơ chứng từ! Đơn hàng đã sẵn sàng để xếp xe.'
        );
      } else {
        await orderApi.confirmOrder(order.id || order.order_id, currentAgreedPrice);
        const updatedOrder = {
          ...order,
          status: 'READY_FOR_PLANNING',
          documents: approvedDocs
        };
        onUpdateOrder?.(updatedOrder);
        message.success('Đã xác nhận toàn bộ chứng từ! Đơn hàng đã sẵn sàng để xếp xe.');
      }
    } catch (err) {
      console.error(err);
      message.error(err.message || 'Lỗi khi xác nhận chứng từ trên máy chủ');
    } finally {
      setConfirmingDocs(false);
    }
  };

  return {
    documents,
    setDocuments,
    hasRejectedDocs,
    isDocsApprovedStage,
    confirmingDocs,
    rejectDocModalOpen,
    setRejectDocModalOpen,
    rejectingDocKey,
    setRejectingDocKey,
    rejectDocReason,
    setRejectDocReason,
    submittingRejectDoc,
    contractUploaded,
    uploadingContract,
    newDocName,
    setNewDocName,
    selectedSpecializedDoc,
    setSelectedSpecializedDoc,
    fileInputRef,
    contractInputRef,
    triggerUploadDoc,
    handleFileChange,
    handleContractFileChange,
    handleApproveDoc,
    handleRejectDoc,
    handleConfirmRejectDoc,
    handleAddCustomDoc,
    handleApplyAssistantRecommendations,
    handleDeleteCustomDoc,
    handleConfirmAllDocuments
  };
}
