"use client";
import { Suspense } from "react";
import { UserProvider } from "@/app/context/UserContext";
import { SiteShell } from "@/app/components/Site/SiteShell";
import AuthForm from "../_components/AuthForm";

export default function Page() {
  return (
    <UserProvider>
      <SiteShell footer={false}>
        <Suspense>
          <AuthForm role="DOCTOR" />
        </Suspense>
      </SiteShell>
    </UserProvider>
  );
}
