'use client';

import { useState, useMemo, useEffect } from "react";
import { Hospital, LocateFixed, MapPin, Search, Star } from "lucide-react";
import { Button } from '@/components/ui/button';
import { cn } from "@/lib/utils";
import { MapProvider, useMap } from "../context/MapContext";
import { MapDisplay } from "./_components/maps";
import { SiteHeader } from "../components/Site/SiteHeader";

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function HospitalList() {
  const { places, userLocation, selectPlace, selectedPlace, status, locate } = useMap();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    locate();
  }, [locate]);

  const hospitals = useMemo(() => {
    if (!places || !userLocation) return [];

    return places
      .map((p: any) => {
        const loc = p.geometry?.location;
        const distance = loc
          ? (() => {
              const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
              const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
              return haversineDistance(userLocation.lat, userLocation.lng, lat, lng).toFixed(2);
            })()
          : "–";
        return { ...p, distance };
      })
      .filter((p: any) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a: any, b: any) => parseFloat(a.distance) - parseFloat(b.distance));
  }, [places, userLocation, searchQuery]);

  return (
    <aside className="flex min-h-0 flex-col rounded-2xl border border-border bg-card/60 lg:w-[360px] lg:shrink-0">
      <div className="border-b border-border p-5">
        <p className="font-mono text-xs tracking-wider text-brand uppercase">Hospitals</p>
        <h1 className="mt-2 font-serif text-2xl text-foreground">Care near you</h1>
        <div className="relative mt-4">
          <Search size={15} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search hospitals"
            aria-label="Search hospitals"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-border bg-background py-2 pr-4 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--brand-ink)] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand-tint)]"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {hospitals.length > 0 ? (
          hospitals.map((h: any, i: number) => (
            <button
              key={h.place_id || i}
              type="button"
              onClick={() => selectPlace(h)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
                selectedPlace?.place_id === h.place_id
                  ? "border-[var(--brand-line)] bg-brand-tint"
                  : "border-transparent hover:bg-surface",
              )}
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
                <Hospital size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">{h.name}</span>
                <span className="block truncate text-sm text-muted-foreground">{h.vicinity}</span>
                <span className="mt-1 flex items-center gap-3 font-mono text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin size={12} /> {h.distance} km</span>
                  {h.rating && <span className="flex items-center gap-1"><Star size={12} /> {h.rating}</span>}
                </span>
              </span>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {userLocation && searchQuery ? "No hospitals match that search." : status}
            </p>
            {!userLocation && (
              <Button variant="outline" size="sm" className="mt-4" onClick={locate}>
                <LocateFixed /> Use my location
              </Button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export default function Page() {
  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader />
      <MapProvider>
        <main className="flex min-h-0 flex-1 flex-col gap-4 p-4 pt-2 lg:flex-row">
          <HospitalList />
          <div className="min-h-64 flex-1 overflow-hidden rounded-2xl border border-border">
            <MapDisplay />
          </div>
        </main>
      </MapProvider>
    </div>
  );
}
