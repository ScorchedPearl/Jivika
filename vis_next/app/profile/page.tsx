"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Mail, MapPin, Hospital } from "lucide-react"
import { ChatLayout } from "../components/chatbox/Chat-Layout"
import { EmptyState } from "../components/Site/EmptyState"
import { LinkButton } from "../components/Site/LinkButton"
import { EditProfileModal } from "./editProfile"
import { getAuthToken } from "@/lib/auth-utils"

interface Appointment {
  id: string
  doctor: {
    id: string
    name: string
    hospital?: string
  }
  patient: {
    id: string
    name: string
  }
  appointmentTime: string
  description: string
  status?: string
}

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loadingAppointments, setLoadingAppointments] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/user/current-user`, {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
          },
        })
        if (res.ok) {
          const data = await res.json()
          console.log("Fetched user:", data)
          setUser(data)
        } else {
          console.error("Failed to fetch user:", res.status)
        }
      } catch (err) {
        console.error("Error fetching user:", err)
      }
    }
    fetchUser()
  }, [])

  useEffect(() => {
    const loadAppointments = async () => {
      if (!user) return
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/me/appointments`, {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setAppointments(data)
        } else {
          console.error("Failed to fetch appointments:", response.status)
          setAppointments([])
        }
      } catch (error) {
        console.error("Error loading appointments:", error)
        setAppointments([])
      } finally {
        setLoadingAppointments(false)
      }
    }

    if (user) loadAppointments()
  }, [user])

  const getInitials = (name: string) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
  }

  const dateTile = (dateString: string) => {
    const date = new Date(dateString)
    return {
      weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
      day: date.getDate(),
      month: date.toLocaleDateString("en-US", { month: "short" }),
      time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    }
  }

  const isDoctor = user?.role === "DOCTOR"

  return (
    <ChatLayout>
      <div className="flex h-full flex-col overflow-y-auto bg-glow">
        <div className="mx-auto w-full max-w-3xl animate-rise px-4 pt-16 pb-12 sm:px-6 md:pt-12">
          <p className="font-mono text-xs tracking-wider text-brand uppercase">Your profile</p>

          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar className="size-20 rounded-2xl">
              <AvatarImage src={user?.profilePhoto} alt={user?.name} />
              <AvatarFallback className="rounded-2xl bg-brand-tint font-serif text-2xl text-brand">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-serif text-4xl tracking-tight text-foreground">{user?.name || "Your account"}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 font-mono text-[11px] uppercase">{isDoctor ? "Doctor" : "Patient"}</span>
                <span className="flex items-center gap-1.5 break-all"><Mail size={14} /> {user?.email}</span>
                {isDoctor && user?.hospital && (
                  <span className="flex items-center gap-1.5"><Hospital size={14} /> {user.hospital}</span>
                )}
              </div>
            </div>
            <Button variant="outline" className="shrink-0" onClick={() => setEditOpen(true)}>
              Edit profile
            </Button>
          </div>

          <section className="mt-12">
            <h2 className="font-serif text-2xl text-foreground">{isDoctor ? "Patient appointments" : "Your appointments"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isDoctor ? "Requests from patients who chose you." : "Requests you've sent to doctors."}
            </p>

            <div className="mt-5 space-y-3">
              {loadingAppointments ? (
                <div className="flex justify-center py-12 text-muted-foreground">
                  <Loader2 className="animate-spin" size={22} />
                </div>
              ) : appointments.length > 0 ? (
                appointments.map((appointment) => {
                  const { weekday, day, month, time } = dateTile(appointment.appointmentTime)
                  return (
                    <article key={appointment.id} className="flex gap-4 rounded-2xl border border-border bg-card/60 p-5">
                      <div className="h-fit shrink-0 rounded-xl bg-surface px-3 py-2 text-center">
                        <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">{weekday}</p>
                        <p className="font-serif text-2xl leading-none text-foreground">{day}</p>
                        <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">{month}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="font-serif text-xl text-foreground">
                            {isDoctor
                              ? appointment.patient?.name || "Unknown patient"
                              : appointment.doctor?.name || "Unknown doctor"}
                          </h3>
                          <span className="rounded-full bg-brand-tint px-2.5 py-1 font-mono text-[11px] text-brand uppercase">
                            {appointment.status || "Pending"}
                          </span>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 font-mono text-xs text-muted-foreground">
                          <span>{time}</span>
                          <span className="flex items-center gap-1">
                            <MapPin size={12} />
                            {(isDoctor ? user.hospital : appointment.doctor?.hospital) || "Hospital not listed"}
                          </span>
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{appointment.description}</p>
                      </div>
                    </article>
                  )
                })
              ) : (
                <EmptyState
                  title="No appointments yet"
                  body={isDoctor ? "Patient requests will appear here." : "Find a doctor and send a request to see it here."}
                >
                  {!isDoctor && <LinkButton href="/doctors">Find a doctor</LinkButton>}
                </EmptyState>
              )}
            </div>
          </section>
        </div>
      </div>

      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        currentUser={user}
        onProfileUpdated={setUser}
      />
    </ChatLayout>
  )
}
