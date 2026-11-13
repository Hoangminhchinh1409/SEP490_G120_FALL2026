import { fetchWithAuth, fetchWithoutAuth } from './apiClient';

export const dispatcherApi = {
  // --- 1. Fleet & Drivers & Vendors ---
  getTrucks: async () => {
    try {
      const data = await fetchWithAuth('/fleet/trucks');
      return data.trucks || [];
    } catch (error) {
      console.warn('dispatcherApi.getTrucks warn:', error?.message);
      return [];
    }
  },

  createTruck: async (truckData) => {
    try {
      const data = await fetchWithAuth('/fleet/trucks', {
        method: 'POST',
        body: JSON.stringify(truckData)
      });
      return data.truck;
    } catch (error) {
      console.error('dispatcherApi.createTruck error:', error);
      throw error;
    }
  },

  updateTruck: async (id, updateData) => {
    try {
      const data = await fetchWithAuth(`/fleet/trucks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });
      return data.truck;
    } catch (error) {
      console.error('dispatcherApi.updateTruck error:', error);
      throw error;
    }
  },

  getDrivers: async () => {
    try {
      const data = await fetchWithAuth('/fleet/drivers');
      return data.drivers || [];
    } catch (error) {
      console.warn('dispatcherApi.getDrivers warn:', error?.message);
      return [];
    }
  },

  updateDriver: async (id, updateData) => {
    try {
      const data = await fetchWithAuth(`/fleet/drivers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });
      return data.driver;
    } catch (error) {
      console.error('dispatcherApi.updateDriver error:', error);
      throw error;
    }
  },

  getVendors: async () => {
    try {
      const data = await fetchWithAuth('/fleet/vendors');
      return data.vendors || [];
    } catch (error) {
      console.warn('dispatcherApi.getVendors warn:', error?.message);
      return [];
    }
  },

  // --- 2. Locations ---
  getLocations: async () => {
    try {
      const data = await fetchWithAuth('/locations');
      return data.locations || [];
    } catch (error) {
      console.warn('dispatcherApi.getLocations warn:', error?.message);
      return [];
    }
  },

  createLocation: async (locationData) => {
    try {
      const data = await fetchWithAuth('/locations', {
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
      const data = await fetchWithAuth(`/locations/${id}`, {
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
      const data = await fetchWithAuth(`/locations/${id}`, {
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
      const data = await fetchWithAuth('/contracts');
      return data.contracts || [];
    } catch (error) {
      console.warn('dispatcherApi.getContracts warn:', error?.message);
      return [];
    }
  },

  getOrderDocumentsBundle: async () => {
    try {
      const data = await fetchWithAuth('/contracts/documents-bundle');
      return data.documents_bundle || [];
    } catch (error) {
      console.warn('dispatcherApi.getOrderDocumentsBundle warn:', error?.message);
      return [];
    }
  },

  createContract: async (contractData) => {
    try {
      const data = await fetchWithAuth('/contracts', {
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
      const data = await fetchWithAuth('/customers');
      return data.customers || [];
    } catch (error) {
      console.warn('dispatcherApi.getCustomers warn:', error?.message);
      return [];
    }
  },

  // --- 4. Trips & Planning ---
  getTrips: async () => {
    try {
      const data = await fetchWithAuth('/trips');
      return data.trips || [];
    } catch (error) {
      console.warn('dispatcherApi.getTrips warn:', error?.message);
      return [];
    }
  },

  createTrip: async (tripData) => {
    try {
      const data = await fetchWithAuth('/trips', {
        method: 'POST',
        body: JSON.stringify(tripData)
      });
      return data.trip;
    } catch (error) {
      console.error('dispatcherApi.createTrip error:', error);
      throw error;
    }
  },

  updateTripStatus: async (id, status) => {
    try {
      const data = await fetchWithAuth(`/trips/${id}/status`, {
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
      const data = await fetchWithAuth(`/trips/${id}/replay`);
      return data;
    } catch (error) {
      console.warn('dispatcherApi.getTripReplay warn:', error?.message);
      return null;
    }
  },

  getIncidents: async () => {
    try {
      const data = await fetchWithAuth('/incidents');
      return data.incidents || [];
    } catch (error) {
      console.warn('dispatcherApi.getIncidents warn:', error?.message);
      return [];
    }
  },

  createIncident: async (incidentData) => {
    try {
      const data = await fetchWithAuth('/incidents', {
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

      const data = await fetchWithAuth(`/incidents/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(bodyPayload)
      });
      return data.incident;
    } catch (error) {
      console.error('dispatcherApi.updateIncidentStatus error:', error);
      throw error;
    }
  },

  getLeaveReassignments: async () => {
    try {
      const data = await fetchWithAuth('/dispatcher/leave-reassignments');
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
  getDashboardStats: async () => {
    try {
      const data = await fetchWithAuth('/dispatcher/dashboard-stats');
      return data.stats;
    } catch (error) {
      console.warn('dispatcherApi.getDashboardStats warn:', error?.message);
      return null;
    }
  }
};
