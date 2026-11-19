'use client';

import type { Map as LeafletMap } from 'leaflet';
import {
  useState,
  useCallback,
  useContext,
  createContext,
  ReactNode,
  useEffect,
} from 'react';

export interface Place {
  place_id: string;
  name: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  vicinity: string;
  types: string[];
}

interface MapContextType {
  map: LeafletMap | null;
  onLoad: (map: LeafletMap) => void;
  onUnmount: () => void;
  userLocation: { lat: number; lng: number } | null;
  places: Place[];
  status: string;
  selectedPlace: Place | null;
  selectPlace: (place: Place | null) => void;
  panTo: (position: { lat: number; lng: number }) => void;
  locate: () => void;
}

const MapContext = createContext<MapContextType | null>(null);

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [status, setStatus] = useState('Initializing map...');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const panTo = useCallback(
    (position: { lat: number; lng: number }) => {
      if (map) {
        map.setView(position, 14);
      }
    },
    [map]
  );

  const fetchNearbyPlaces = async (lat: number, lng: number) => {
    setStatus('Finding hospitals near you...');
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/places/nearby-osm?lat=${lat}&lng=${lng}&radius=3000&keyword=hospital`
      );

      if (!res.ok) throw new Error('Failed to fetch places from backend');

      const osmData = await res.json();

      if (!osmData.elements) {
        setStatus('No places found.');
        setPlaces([]);
        return;
      }

      const mapped: Place[] = osmData.elements
        .filter((el: any) => el.lat && el.lon && el.tags?.name)
        .map((el: any) => ({
          place_id: el.id.toString(),
          name: el.tags.name || 'Unnamed Place',
          geometry: {
            location: {
              lat: el.lat,
              lng: el.lon,
            },
          },
          vicinity: el.tags['addr:full'] || el.tags['addr:city'] || 'Address not available',
          types: [el.tags.amenity || 'unknown'],
        }));

      setPlaces(mapped);
      setStatus(mapped.length > 0 ? `Found ${mapped.length} hospitals nearby.` : 'No hospitals found.');
    } catch (error) {
      console.error(error);
      setStatus('Error finding nearby places.');
    }
  };

  // The hospital list comes from OpenStreetMap, so it works with or without a loaded map
  const locate = useCallback(() => {
    setStatus('Getting your location...');
    if (!navigator.geolocation) {
      setStatus('Your browser does not support location.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(pos);
        fetchNearbyPlaces(pos.lat, pos.lng);
      },
      () => {
        setStatus('Allow location access to see hospitals near you.');
      }
    );
  }, []);

  useEffect(() => {
    if (map && userLocation) panTo(userLocation);
  }, [map, userLocation, panTo]);

  useEffect(() => {
    if (map && !userLocation) locate();
  }, [map, userLocation, locate]);

  const onLoad = useCallback((mapInstance: LeafletMap) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const selectPlace = (place: Place | null) => {
    setSelectedPlace(place);
    if (place) {
      panTo(place.geometry.location);
    }
  };

  const value = {
    map,
    onLoad,
    onUnmount,
    userLocation,
    places,
    status,
    selectedPlace,
    selectPlace,
    panTo,
    locate,
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMap() {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMap must be used within a MapProvider');
  }
  return context;
}
