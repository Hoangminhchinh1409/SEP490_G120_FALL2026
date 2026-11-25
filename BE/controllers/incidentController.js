const {
  getAllIncidents,
  createIncident,
  updateIncidentStatus,
  getIncidents,
  getIncidentById
} = require('./incident/incidentQueryController');

const {
  resolveIncident,
  decideIncidentCompensation,
  closeIncidentCase
} = require('./incident/incidentReviewController');

const {
  createDispatcherClaim,
  getClaims,
  getClaimById,
  decideClaim,
  recordDispatcherClaimCall,
  recordManagerClaimPayment,
  sendIncidentDecisionEmail
} = require('./incident/incidentClaimController');

module.exports = {
  getAllIncidents,
  createIncident,
  updateIncidentStatus,
  createDispatcherClaim,
  getIncidents,
  getIncidentById,
  resolveIncident,
  decideIncidentCompensation,
  sendIncidentDecisionEmail,
  closeIncidentCase,
  getClaims,
  getClaimById,
  decideClaim,
  recordDispatcherClaimCall,
  recordManagerClaimPayment,
  getApprovals: getClaims,
  decideApproval: decideClaim
};
