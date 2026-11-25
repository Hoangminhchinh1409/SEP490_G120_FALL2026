const {
  sendOrderPriceConfirmationEmail,
  sendDocumentRejectionEmail,
  sendContractSigningEmail,
  sendPasswordResetEmail,
  sendContractToCustomerEmail
} = require('./email/emailOrderTemplates');

const {
  sendIncidentCompensationApprovalEmail,
  sendIncidentCompensationRejectionEmail,
  sendClaimPaymentRecordedEmail
} = require('./email/emailClaimTemplates');

module.exports = {
  sendOrderPriceConfirmationEmail,
  sendDocumentRejectionEmail,
  sendContractSigningEmail,
  sendContractToCustomerEmail,
  sendPasswordResetEmail,
  sendIncidentCompensationApprovalEmail,
  sendIncidentCompensationRejectionEmail,
  sendClaimPaymentRecordedEmail
};
