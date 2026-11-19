"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Hospital, Search } from "lucide-react";
import axios from "axios";
import { Container } from "../components/Site/Container";
import { EmptyState } from "../components/Site/EmptyState";
import { PageHero } from "../components/Site/PageHero";
import { SiteShell } from "../components/Site/SiteShell";

interface Doctor {
  id: string;
  name: string;
  hospital: string;
  role: string;
  profilePhoto?: string;
}

function initials(name: string) {
  return name
    .replace(/^Dr\.?\s+/i, "")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadDoctors = async () => {
      try {
        const token = localStorage.getItem("__Pearl_Token");
        const res = await axios.get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/doctors`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDoctors(res.data);
      } catch (error) {
        console.error("Failed to load doctors:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDoctors();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return doctors.filter((d) => `${d.name} ${d.hospital}`.toLowerCase().includes(query));
  }, [doctors, search]);

  return (
    <SiteShell>
      <PageHero
        eyebrow="Doctors"
        title={
          <>
            Talk to someone who can <em className="text-gradient pr-1 font-medium">help</em>
          </>
        }
        intro="Choose a doctor and request an appointment. Your request and its status appear on your profile."
      >
        <div className="relative mt-7 max-w-md">
          <Search size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or hospital"
            aria-label="Search doctors"
            className="w-full rounded-full border border-border bg-card/70 py-2.5 pr-4 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--brand-ink)] focus:outline-none focus:ring-[3px] focus:ring-[var(--brand-tint)]"
          />
        </div>
      </PageHero>

      <Container className="pt-4">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-card/60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={doctors.length === 0 ? "No doctors yet" : "No matches"}
            body={doctors.length === 0 ? "Doctors appear here once they join Jivika." : "Try a different name or hospital."}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((doctor) => (
              <Link
                key={doctor.id}
                href={`/doctors/${doctor.id}`}
                className="group flex flex-col rounded-2xl border border-border bg-card/60 p-6 transition hover:-translate-y-0.5 hover:border-[var(--brand-line)] hover:bg-card"
              >
                <div className="flex items-center gap-4">
                  {doctor.profilePhoto ? (
                    <img src={doctor.profilePhoto} alt="" className="size-12 rounded-xl object-cover" />
                  ) : (
                    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-tint font-serif text-lg text-brand">
                      {initials(doctor.name)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate font-serif text-xl text-foreground group-hover:text-brand">{doctor.name}</h2>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                      <Hospital size={13} className="shrink-0" />
                      {doctor.hospital || "Independent"}
                    </p>
                  </div>
                </div>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand">
                  Book appointment <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </SiteShell>
  );
}
