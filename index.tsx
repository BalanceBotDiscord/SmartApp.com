/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';

// Using Leaflet from global scope, loaded via script tag in index.html
declare const L: any;

interface Location {
  name: string;
  latitude: number;
  longitude: number;
  description: string;
}

// --- Main App Setup ---
const searchForm = document.getElementById('search-form') as HTMLFormElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const loader = document.getElementById('loader') as HTMLDivElement;
const locationBtn = document.getElementById('location-btn') as HTMLButtonElement;
const poiButtons = document.querySelectorAll('.poi-btn');
let map: any;
let markersLayer = L.featureGroup();
let userLocationMarker: any;

// Custom icon for user's location
const userLocationIcon = L.divIcon({
  html: `<div class="user-location-dot"></div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// --- Gemini AI Setup ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
const model = 'gemini-2.5-flash';
const locationSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: 'The name of the location.',
      },
      latitude: {
        type: Type.NUMBER,
        description: 'The latitude of the location.',
      },
      longitude: {
        type: Type.NUMBER,
        description: 'The longitude of the location.',
      },
      description: {
        type: Type.STRING,
        description: 'A brief, one-sentence description of the location.',
      },
    },
    required: ['name', 'latitude', 'longitude', 'description'],
  },
};

/**
 * Initializes the Leaflet map.
 */
function initMap() {
  map = L.map('map').setView([48.8566, 2.3522], 13); // Default to Paris

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  markersLayer.addTo(map);
}

/**
 * Shows or hides the loading spinner.
 * @param show - True to show, false to hide.
 */
function showLoader(show: boolean) {
  loader.classList.toggle('hidden', !show);
}

/**
 * Updates the map with markers for the given locations.
 * @param locations - An array of location objects.
 */
function updateMap(locations: Location[]) {
  markersLayer.clearLayers();

  if (!locations || locations.length === 0) {
    alert("Sorry, I couldn't find any locations for that query.");
    return;
  }

  locations.forEach(location => {
    const marker = L.marker([location.latitude, location.longitude]);
    
    const popupContent = `
      <h3>${location.name}</h3>
      <p>${location.description}</p>
      <div class="popup-actions">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}" class="popup-btn" target="_blank" rel="noopener noreferrer">Directions</a>
        <a href="https://www.google.com/maps?q&layer=c&cbll=${location.latitude},${location.longitude}" class="popup-btn" target="_blank" rel="noopener noreferrer">Street View</a>
      </div>
    `;
    
    marker.bindPopup(popupContent);
    markersLayer.addLayer(marker);
  });

  map.fitBounds(markersLayer.getBounds(), { padding: [50, 50] });
}

/**
 * Fetches locations from the Gemini API based on a user query.
 * @param query - The user's search query.
 */
async function fetchLocations(query: string) {
  showLoader(true);
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `You are a helpful map assistant. Based on the user's request, find relevant real-world locations and provide them as a JSON array. User's request: "${query}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: locationSchema,
      },
    });
    
    const jsonStr = response.text.trim();
    const locations = JSON.parse(jsonStr) as Location[];
    updateMap(locations);

  } catch (error) {
    console.error('Error fetching from Gemini API:', error);
    alert('An error occurred while fetching locations. Please try again.');
  } finally {
    showLoader(false);
  }
}

/**
 * Handles the search form submission.
 * @param event - The form submission event.
 */
function handleSearch(event: Event) {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (query) {
    fetchLocations(query);
  }
}

/**
 * Gets the user's current location and updates the map.
 */
function getUserLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  showLoader(true);
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const userLatLng = [latitude, longitude];

      map.setView(userLatLng, 15); // Zoom in closer for user location

      if (userLocationMarker) {
        userLocationMarker.setLatLng(userLatLng);
      } else {
        userLocationMarker = L.marker(userLatLng, { icon: userLocationIcon }).addTo(map);
      }
      userLocationMarker.bindPopup("<h3>You are here</h3>").openPopup();
      
      showLoader(false);
    },
    (error) => {
      showLoader(false);
      console.error("Error getting user location:", error);
      alert("Unable to retrieve your location. Please ensure location services are enabled.");
    }
  );
}

/**
 * Handles clicks on the POI category buttons.
 * @param event - The button click event.
 */
function handlePoiSearch(event: Event) {
  const target = event.currentTarget as HTMLButtonElement;
  const category = target.dataset.category;

  if (category) {
    const mapCenter = map.getCenter();
    const query = `Find ${category} near latitude ${mapCenter.lat}, longitude ${mapCenter.lng}`;
    searchInput.value = `Nearby ${category.charAt(0).toUpperCase() + category.slice(1)}`;
    fetchLocations(query);
  }
}


// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  searchForm.addEventListener('submit', handleSearch);
  locationBtn.addEventListener('click', getUserLocation);
  poiButtons.forEach(button => {
    button.addEventListener('click', handlePoiSearch);
  });
});

export {};
