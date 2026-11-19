"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/app/components/Site/form";
import { AuthCard } from "./AuthCard";
import { OTPInput } from "./otpInput";

export default function OTPEntryPage({
  email,
  sendError,
  onResend,
  onVerified,
  onBack,
}: {
  email: string;
  sendError: string | null;
  onResend: () => void;
  onVerified: () => Promise<void>;
  onBack: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resent, setResent] = useState(false);

  const handleOTPComplete = async (otp: string) => {
    setError(null);
    if (otp !== localStorage.getItem("currentOtp")) {
      setError("That code isn't right. Please check it and try again.");
      return;
    }
    setIsSubmitting(true);
    await onVerified();
    setIsSubmitting(false);
  };

  return (
    <AuthCard icon={Mail} title="Check your email" subtitle={`Enter the 6-digit code we sent to ${email}.`}>
      <OTPInput length={6} onComplete={handleOTPComplete} />

      <div className="mt-4 space-y-3">
        {(sendError || error) && <FormAlert>{sendError || error}</FormAlert>}
        {resent && !sendError && <FormAlert tone="success">We've sent a new code.</FormAlert>}
      </div>

      <Button
        className="mt-5 w-full"
        disabled={isSubmitting}
        onClick={() => {
          const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[aria-label*="of OTP"]'));
          handleOTPComplete(inputs.map((input) => input.value).join(""));
        }}
      >
        {isSubmitting ? "Verifying..." : "Verify code"}
      </Button>

      <div className="mt-5 flex items-center justify-between text-sm text-muted-foreground">
        <button type="button" onClick={onBack} className="hover:text-foreground">
          Go back
        </button>
        <button
          type="button"
          onClick={() => {
            onResend();
            setResent(true);
          }}
          className="font-medium text-brand hover:underline"
        >
          Resend code
        </button>
      </div>
    </AuthCard>
  );
}
