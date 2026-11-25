import { fetchWithAuth } from './apiClient';

export const dispatcherApi = {
  // --- 1. Fleet & Drivers & Vendors ---
  getTrucks: async () => {
    try {
      const data = await fetchWithAuth('/dispatcher/fleet/trucks');
      return data.trucks || [];
    } catch (error) {
      console.warn('dispatcherApi.getTrucks warn:', error?.message);
      return [];
    }
  },

  createTruck: async (truckData) => {
    try {
      const data = await fetchWithAuth('/dispatcher/fleet/trucks', {
        method: 'POST',
        body: JSON.stringify(truckData)
      });
      return data.truck;
    } catch (error) {
      console.warn('dispatcherApi.createTruck warning:', error.message || error);
      throw error;
    }
  },

  updateTruck: async (id, updateData) => {
    try {
      const data = await fetchWithAuth(`/dispatcher/fleet/trucks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });
      return data.truck;
    } catch (error) {
      console.warn('dispatcherApi.updateTruck warning:', error.message || error);
      throw error;
    }
  },

  getDrivers: async () => {
    try {
      const data = await fetchWithAuth('/dispatcher/fleet/drivers');
      return data.drivers || [];
    } catch (error) {
      console.warn('dispatcherApi.getDrivers warn:', error?.message);
      return [];
    }
  },

  updateDriver: async (id, updateData) => {
    try {
      const data = await fetchWithAuth(`/dispatcher/fleet/drivers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });
      return data.driver;
    } catch (error) {
      console.warn('dispatcherApi.updateDriver warning:', error.message || error);
      throw error;
    }
  },

  getVendors: async () => {
    try {
      const data = await fetchWithAuth('/dispatcher/fleet/vendors');
      return data.vendors || [];
    } catch (error) {
      console.warn('dispatcherApi.getVendors warn:', error?.message);
      return [];
    }
  },

  // --- 2. Locations ---
  getLocations: async () => {
    try {
      const data = await fetchWithAuth('/dispatcher/locations');
      return data.locations || [];
    } catch (error) {
      console.warn('dispatcherApi.getLocations warn:', error?.message);
      return [];
    }
  },

  getAlsWarehouses: async () => {
    try {
      const data = await fetchWithAuth('/dispatcher/locations?als_only=true');
      return data.locations || [];
    } catch (error) {
      console.warn('dispatcherApi.getAlsWarehouses warn:', error?.message);
      return [];
    }
  },

  createLocation: async (locationData) => {
    try {
      const data = await fetchWithAuth('/dispatcher/locations', {
        method: 'POST',
        body: JSON.stringify(locationData)
      });
      return data.location;
    } catch (error) {
      console.error('dispatcherApi.createLocation error:', error);
      throw error;
    }
  },

  updateLocation: async (id, locationData) => {
    try {
      const data = await fetchWithAuth(`/dispatcher/locations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(locationData)
      });
      return data.location;
    } catch (error) {
      console.error('dispatcherApi.updateLocation error:', error);
      throw error;
    }
  },

  deleteLocation: async (id) => {
    try {
      const data = await fetchWithAuth(`/dispatcher/locations/${id}`, {
        method: 'DELETE'
      });
      return data;
    } catch (error) {
      console.error('dispatcherApi.deleteLocation error:', error);
      throw error;
    }
  },

  // --- 3. Transport Contracts ---
  getContracts: async () => {
    try {
      const data = await fetchWithAuth('/dispatcher/contracts');
      return data.contracts || [];
    } catch (error) {
      console.warn('dispatcherApi.getContracts warn:', error?.message);
      return [];
    }
  },

  getOrderDocumentsBundle: async () => {
    try {
      const data = await fetchWithAuth('/dispatcher/contracts/documents-bundle');
      return data.documents_bundle || [];
    } catch (error) {
      console.warn('dispatcherApi.getOrderDocumentsBundle warn:', error?.message);
      return [];
    }
  },

  createContract: async (contractData) => {
    try {
      const data = await fetchWithAuth('/dispatcher/contracts', {
        method: 'POST',
        body: JSON.stringify(contractData)
      });
      return data.contract;
    } catch (error) {
      console.error('dispatcherApi.createContract error:', error);
      throw error;
    }
  },

  getCustomers: async () => {
    try {
      const data = await fetchWithAuth('/dispatcher/customers');
      return data.customers || [];
    } catch (error) {
      console.warn('dispatcherApi.getCustomers warn:', error?.message);
      return [];
    }
  },

  // --- 4. Trips & Planning ---
  getTrips: async () => {
    try {
      const data = await fetchWithAuth('/dispatcher/trips');
      return data.trips || [];
    } catch (error) {
      console.warn('dispatcherApi.getTrips warn:', error?.message);
      return [];
    }
  },

  createTrip: async (tripData) => {
    try {
      const data = await fetchWithAuth('/dispatcher/trips', {
        method: 'POST',
        body: JSON.stringify(tripData)
      });
      return data.trip;
    } catch (error) {
      console.warn('dispatcherApi.createTrip warning:', error.message || error);
      throw error;
    }
  },

  updateTripStatus: async (id, status) => {
    try {
      const data = await fetchWithAuth(`/dispatcher/trips/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      return data.trip;
    } catch (error) {
      console.error('dispatcherApi.updateTripStatus error:', error);
      throw error;
    }
  },

  getTripReplay: async (id) => {
    try {
      const data = await fetchWithAuth(`/dispatcher/trips/${id}/replay`);
      return data;
    } catch (error) {
      console.warn('dispatcherApi.getTripReplay warn:', error?.message);
      return null;
    }
  },

  getIncidents: async () => {
    try {
      const data = await fetchWithAuth('/dispatcher/incidents');
      return data.incidents || [];
    } catch (error) {
      console.warn('dispatcherApi.getIncidents warn:', error?.message);
      return [];
    }
  },

  createIncident: async (incidentData) => {
    try {
      const data = await fetchWithAuth('/dispatcher/incidents', {
        method: 'POST',
        body: JSON.stringify(incidentData)
      });
      return data.incident;
    } catch (error) {
      console.error('dispatcherApi.createIncident error:', error);
      throw error;
    }
  },

  updateIncidentStatus: async (id, statusOrPayload) => {
    try {
      const bodyPayload =
        typeof statusOrPayload === 'object' && statusOrPayload !== null
          ? statusOrPayload
          : { status: statusOrPayload };

      const data = await fetchWithAuth(`/dispatcher/incidents/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(bodyPayload)
      });
      return data.incident;
    } catch (error) {
      console.error('dispatcherApi.updateIncidentStatus error:', error);
      throw error;
    }
  },

  createClaim: async (claimData) => {
    try {
      const data = await fetchWithAuth('/dispatcher/claims', {
        method: 'POST',
        body: JSON.stringify(claimData)
      });
      return data;
    } catch (error) {
      console.error('dispatcherApi.createClaim error:', error);
      throw error;
    }
  },

  getClaims: async () => {
    try {
      const data = await fetchWithAuth('/dispatcher/claims');
      return data;
    } catch (error) {
      console.error('dispatcherApi.getClaims error:', error);
      throw error;
    }
  },

  getClaimById: async (id) => {
    try {
      const data = await fetchWithAuth(`/dispatcher/claims/${id}`);
      return data.claim;
    } catch (error) {
      console.error('dispatcherApi.getClaimById error:', error);
      throw error;
    }
  },

  recordClaimCall: async (id, payload) => {
    try {
      const data = await fetchWithAuth(`/dispatcher/claims/${id}/record-call`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return data;
    } catch (error) {
      console.error('dispatcherApi.recordClaimCall error:', error);
      throw error;
    }
  },

  getLeaveReassignments: async (options = {}) => {
    try {
      const qs = options?.refresh ? '?refresh=1' : '';
      const data = await fetchWithAuth(`/dispatcher/leave-reassignments${qs}`);
      return {
        reassignments: data?.reassignments || [],
        availableDrivers: data?.availableDrivers || []
      };
    } catch (error) {
      console.warn('dispatcherApi.getLeaveReassignments warn:', error?.message);
      return {
        reassignments: [],
        availableDrivers: []
      };
    }
  },

  reassignTripDriver: async (tripId, { new_driver_id, reason }) => {
    try {
      const data = await fetchWithAuth(`/dispatcher/trips/${tripId}/reassign-driver`, {
        method: 'PATCH',
        body: JSON.stringify({ new_driver_id, reason })
      });
      return data;
    } catch (error) {
      console.error('dispatcherApi.reassignTripDriver error:', error);
      throw error;
    }
  },

  // --- 5. Dashboard Stats ---
  getDashboardStats: async (options = {}) => {
    try {
      const qs = options?.refresh ? '?refresh=1' : '';
      const data = await fetchWithAuth(`/dispatcher/dashboard-stats${qs}`);
      const baseKpi = data?.kpi || data?.stats || data || null;
      if (baseKpi && typeof baseKpi === 'object' && Array.isArray(data?.incidentsSummary)) {
        return { ...baseKpi, incidentsSummary: data.incidentsSummary };
      }
      return baseKpi;
    } catch (error) {
      console.warn('dispatcherApi.getDashboardStats warn:', error?.message);
      throw error;
    }
  },

  // --- 6. VRPTW Engine (Vehicle Routing Problem with Time Windows & Hanoi Truck Ban) ---
  optimizeMultiStopRoute: async ({ stops, startTime, truckPayloadKg, avoidTruckBan }) => {
    try {
      const data = await fetchWithAuth('/dispatcher/trips/optimize-vrptw', {
        method: 'POST',
        body: JSON.stringify({ stops, startTime, truckPayloadKg, avoidTruckBan })
      });
      return data;
    } catch (error) {
      console.error('dispatcherApi.optimizeMultiStopRoute error:', error);
      throw error;
    }
  },

  // --- 8. Duyệt phụ phí tài xế đề xuất (BUG-ITD-07) ---
  getExtraFees: async (status = '') => {
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const data = await fetchWithAuth(`/dispatcher/extra-fees${qs}`);
      return data.extra_fees || [];
    } catch (error) {
      console.warn('dispatcherApi.getExtraFees warn:', error?.message);
      return [];
    }
  },

  reviewExtraFee: async (id, action, note = '') => {
    try {
      return await fetchWithAuth(`/dispatcher/extra-fees/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ action, note })
      });
    } catch (error) {
      console.error('dispatcherApi.reviewExtraFee error:', error);
      throw error;
    }
  }
};
