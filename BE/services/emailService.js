const {
  sendOrderPriceConfirmationEmail,
  sendDocumentRejectionEmail,
  sendContractSigningEmail,
  sendPasswordResetEmail,
  sendContractToCustomerEmail,
  sendOrderCancellationEmail
} = require('./email/emailOrderTemplates');

const {
  sendIncidentCompensationApprovalEmail,
  sendIncidentCompensationRejectionEmail,
  sendClaimPaymentRecordedEmail,
  sendIncidentCargoAffectedEmail
} = require('./email/emailClaimTemplates');

module.exports = {
  sendOrderPriceConfirmationEmail,
  sendDocumentRejectionEmail,
  sendContractSigningEmail,
  sendContractToCustomerEmail,
  sendPasswordResetEmail,
  sendIncidentCompensationApprovalEmail,
  sendIncidentCompensationRejectionEmail,
  sendClaimPaymentRecordedEmail,
  sendIncidentCargoAffectedEmail,
  sendOrderCancellationEmail
};
