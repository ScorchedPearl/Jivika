'use client';

import { useEffect, useRef } from 'react';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed } from 'lucide-react';
import { useMap } from '@/app/context/MapContext';

// Shown until the user's location is known
const INDIA_CENTER: [number, number] = [22.5, 79];

// OpenStreetMap tiles, so the map needs no API key
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function MapDisplay() {
  const { map, onLoad, onUnmount, userLocation, places, selectedPlace, selectPlace } = useMap();
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let instance: LeafletMap | null = null;
    let cancelled = false;

    // Leaflet needs the browser's window, so it is loaded after the page renders
    import('leaflet').then(({ default: L }) => {
      if (cancelled || !containerRef.current) return;
      instance = L.map(containerRef.current, { zoomControl: true }).setView(INDIA_CENTER, 5);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(instance);
      markersRef.current = L.layerGroup().addTo(instance);
      onLoad(instance);
    });

    return () => {
      cancelled = true;
      markersRef.current = null;
      onUnmount();
      instance?.remove();
    };
  }, []);

  useEffect(() => {
    const markers = markersRef.current;
    if (!map || !markers) return;
    let cancelled = false;

    import('leaflet').then(({ default: L }) => {
      if (cancelled) return;
      markers.clearLayers();

      if (userLocation) {
        L.circleMarker(userLocation, { radius: 16, weight: 1, className: 'map-pin-halo' }).addTo(markers);
        L.circleMarker(userLocation, { radius: 6, weight: 3, className: 'map-pin-you' })
          .bindTooltip('You are here')
          .addTo(markers);
      }

      places.forEach((place) => {
        const selected = selectedPlace?.place_id === place.place_id;
        const marker = L.circleMarker(place.geometry.location, {
          radius: selected ? 11 : 7,
          weight: 2,
          className: selected ? 'map-pin map-pin-selected' : 'map-pin',
        })
          .bindTooltip(place.name)
          .on('click', () => selectPlace(place))
          .addTo(markers);

        if (selected) {
          // Built as elements, not HTML, because the names come from OpenStreetMap
          const popup = document.createElement('div');
          const name = document.createElement('strong');
          name.textContent = place.name;
          const address = document.createElement('p');
          address.textContent = place.vicinity;
          const link = document.createElement('a');
          link.href = `https://www.openstreetmap.org/directions?to=${place.geometry.location.lat},${place.geometry.location.lng}`;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = 'Get directions';
          popup.append(name, address, link);
          marker.bindPopup(popup).openPopup();
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [map, places, userLocation, selectedPlace]);

  return (
    <div className="relative z-0 h-full min-h-64">
      <button
        type="button"
        onClick={() => map && userLocation && map.setView(userLocation, 14)}
        aria-label="Recenter map"
        className="absolute top-4 right-4 z-[1000] rounded-full border border-border bg-background/90 p-2.5 text-foreground shadow-md backdrop-blur transition hover:bg-background"
      >
        <LocateFixed size={16} />
      </button>
      <div ref={containerRef} className="h-full min-h-64 w-full" />
    </div>
  );
}
