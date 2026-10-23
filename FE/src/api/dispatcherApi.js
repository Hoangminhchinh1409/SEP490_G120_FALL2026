import { fetchWithoutAuth } from './apiClient';

export const dispatcherApi = {
  // --- 1. Fleet & Drivers & Vendors ---
  getTrucks: async () => {
    try {
      const data = await fetchWithoutAuth('/fleet/trucks');
      return data.trucks || [];
    } catch (error) {
      console.error('dispatcherApi.getTrucks error:', error);
      throw error;
    }
  },

  createTruck: async (truckData) => {
    try {
      const data = await fetchWithoutAuth('/fleet/trucks', {
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
      const data = await fetchWithoutAuth(`/fleet/trucks/${id}`, {
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
      const data = await fetchWithoutAuth('/fleet/drivers');
      return data.drivers || [];
    } catch (error) {
      console.error('dispatcherApi.getDrivers error:', error);
      throw error;
    }
  },

  updateDriver: async (id, updateData) => {
    try {
      const data = await fetchWithoutAuth(`/fleet/drivers/${id}`, {
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
      const data = await fetchWithoutAuth('/fleet/vendors');
      return data.vendors || [];
    } catch (error) {
      console.error('dispatcherApi.getVendors error:', error);
      throw error;
    }
  },

  // --- 2. Locations ---
  getLocations: async () => {
    try {
      const data = await fetchWithoutAuth('/locations');
      return data.locations || [];
    } catch (error) {
      console.error('dispatcherApi.getLocations error:', error);
      throw error;
    }
  },

  createLocation: async (locationData) => {
    try {
      const data = await fetchWithoutAuth('/locations', {
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
      const data = await fetchWithoutAuth(`/locations/${id}`, {
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
      const data = await fetchWithoutAuth(`/locations/${id}`, {
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
      const data = await fetchWithoutAuth('/contracts');
      return data.contracts || [];
    } catch (error) {
      console.error('dispatcherApi.getContracts error:', error);
      throw error;
    }
  },

  createContract: async (contractData) => {
    try {
      const data = await fetchWithoutAuth('/contracts', {
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
      const data = await fetchWithoutAuth('/customers');
      return data.customers || [];
    } catch (error) {
      console.error('dispatcherApi.getCustomers error:', error);
      throw error;
    }
  },

  // --- 4. Trips & Planning ---
  getTrips: async () => {
    try {
      const data = await fetchWithoutAuth('/trips');
      return data.trips || [];
    } catch (error) {
      console.error('dispatcherApi.getTrips error:', error);
      throw error;
    }
  },

  createTrip: async (tripData) => {
    try {
      const data = await fetchWithoutAuth('/trips', {
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
      const data = await fetchWithoutAuth(`/trips/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      return data.trip;
    } catch (error) {
      console.error('dispatcherApi.updateTripStatus error:', error);
      throw error;
    }
  },

  getIncidents: async () => {
    try {
      const data = await fetchWithoutAuth('/incidents');
      return data.incidents || [];
    } catch (error) {
      console.error('dispatcherApi.getIncidents error:', error);
      throw error;
    }
  },

  createIncident: async (incidentData) => {
    try {
      const data = await fetchWithoutAuth('/incidents', {
        method: 'POST',
        body: JSON.stringify(incidentData)
      });
      return data.incident;
    } catch (error) {
      console.error('dispatcherApi.createIncident error:', error);
      throw error;
    }
  },

  updateIncidentStatus: async (id, status) => {
    try {
      const data = await fetchWithoutAuth(`/incidents/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      return data.incident;
    } catch (error) {
      console.error('dispatcherApi.updateIncidentStatus error:', error);
      throw error;
    }
  },

  // --- 5. Dashboard Stats ---
  getDashboardStats: async () => {
    try {
      const data = await fetchWithoutAuth('/dispatcher/dashboard-stats');
      return data.stats;
    } catch (error) {
      console.error('dispatcherApi.getDashboardStats error:', error);
      throw error;
    }
  }
};
