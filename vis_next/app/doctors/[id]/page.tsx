"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Hospital, Loader2 } from "lucide-react";
import axios from "axios";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "../../components/Site/Container";
import { EmptyState } from "../../components/Site/EmptyState";
import { LinkButton } from "../../components/Site/LinkButton";
import { Field, FormAlert, inputClass } from "../../components/Site/form";
import { SiteShell } from "../../components/Site/SiteShell";

interface Doctor {
  id: string;
  name: string;
  hospital: string;
  role: string;
  profilePhoto?: string;
}

interface BookingForm {
  name: string;
  phone: string;
  problem: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
}

export default function DoctorBookingPage() {
  const router = useRouter();
  const { id } = useParams();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<BookingForm>({
    name: "",
    phone: "",
    problem: "",
    date: "",
    time: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDoctor = async () => {
      try {
        const token = localStorage.getItem("__Pearl_Token");
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/doctors`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const found = res.data.find((d: Doctor) => d.id === id);
        setDoctor(found || null);
      } catch (err) {
        console.error("Failed to fetch doctor:", err);
      } finally {
        setLoading(false);
      }
    };
    loadDoctor();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // LocalDateTime expected, so send without a timezone
    const appointmentTime = `${formData.date}T${formData.time}:00`;

    setSubmitting(true);
    try {
      const token = localStorage.getItem("__Pearl_Token");
      const payload = {
        doctorId: doctor?.id,
        description: formData.problem.trim(),
        appointmentTime,
      };

      await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/appointments`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSubmitted(true);
      setTimeout(() => router.push("/profile"), 1500);
    } catch (err) {
      console.error("Error booking appointment:", err);
      setError("We couldn't send your request. Make sure you're signed in, then try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SiteShell footer={false}>
        <div className="flex justify-center py-32 text-muted-foreground">
          <Loader2 className="animate-spin" size={22} />
        </div>
      </SiteShell>
    );
  }

  if (!doctor) {
    return (
      <SiteShell footer={false}>
        <Container className="py-16">
          <EmptyState title="Doctor not found" body="This profile may have been removed.">
            <LinkButton href="/doctors">Back to doctors</LinkButton>
          </EmptyState>
        </Container>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="-mt-16 bg-glow pt-16">
        <Container className="animate-rise pt-10">
          <Link href="/doctors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> All doctors
          </Link>

          <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_1.5fr] lg:gap-14">
            <div>
              <p className="font-mono text-xs tracking-wider text-brand uppercase">Book an appointment</p>
              <h1 className="mt-3 font-serif text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl">{doctor.name}</h1>
              <p className="mt-3 flex items-center gap-2 text-muted-foreground">
                <Hospital size={16} />
                {doctor.hospital || "Independent"}
              </p>
              <p className="mt-6 max-w-sm leading-relaxed text-muted-foreground">
                Send a request with a time that suits you. It will show as pending on your profile until it&apos;s confirmed.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card/80 p-6 sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <input name="name" value={formData.name} onChange={handleChange} autoComplete="name" required className={inputClass} />
                </Field>
                <Field label="Phone number">
                  <input name="phone" type="tel" value={formData.phone} onChange={handleChange} autoComplete="tel" required className={inputClass} />
                </Field>
              </div>

              <Field label="What's the problem?">
                <textarea
                  name="problem"
                  value={formData.problem}
                  onChange={handleChange}
                  placeholder="Describe your symptoms and how long you've had them"
                  rows={4}
                  required
                  className={`${inputClass} resize-none`}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Preferred date">
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </Field>
                <Field label="Preferred time">
                  <input type="time" name="time" value={formData.time} onChange={handleChange} required className={inputClass} />
                </Field>
              </div>

              {error && <FormAlert>{error}</FormAlert>}
              {submitted && <FormAlert tone="success">Request sent. Taking you to your profile...</FormAlert>}

              <Button type="submit" className="w-full" disabled={submitting || submitted}>
                {submitting ? "Sending..." : "Request appointment"}
              </Button>
            </form>
          </div>
        </Container>
      </section>
    </SiteShell>
  );
}
