const {
  formatPublicClaim,
  formatDetailedClaim,
  getClaimWindowDays
} = require('./claim/claimHelper');

const {
  createDispatcherClaim,
  getOrderClaimsForTracking,
  createGuestClaimByToken,
  getAllClaimsForPortal,
  getClaimById
} = require('./claim/claimQueryService');

const {
  decideClaim,
  recordDispatcherCall,
  recordManagerPayment,
  confirmCustomerMoneyReceived,
  autoCloseOverduePaidClaims,
  getProtectedClaimOrderAndTripIds
} = require('./claim/claimWorkflowService');

module.exports = {
  createDispatcherClaim,
  getOrderClaimsForTracking,
  createGuestClaimByToken,
  getAllClaimsForPortal,
  getClaimById,
  decideClaim,
  recordDispatcherCall,
  recordManagerPayment,
  confirmCustomerMoneyReceived,
  autoCloseOverduePaidClaims,
  getProtectedClaimOrderAndTripIds,
  formatPublicClaim,
  formatDetailedClaim,
  getClaimWindowDays
};
