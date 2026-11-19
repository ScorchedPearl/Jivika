"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useGoogleLogin, TokenResponse } from "@react-oauth/google";
import { KeyRound, LogIn, Stethoscope, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/app/context/UserContext";
import { enterApp, setAuthToken } from "@/lib/auth-utils";
import { Field, FormAlert, inputClass } from "@/app/components/Site/form";
import { AuthCard } from "./AuthCard";
import OTPEntryPage from "./optpage";

const GOOGLE_SCOPE =
  "openid profile email https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.send";

type Mode = "signin" | "signup" | "forgot";

const copy = {
  USER: {
    signin: { title: "Welcome back", subtitle: "Sign in to pick up where you left off." },
    signup: { title: "Create your account", subtitle: "Save your chats and request appointments." },
  },
  DOCTOR: {
    signin: { title: "Doctor sign in", subtitle: "See your patients' appointment requests." },
    signup: { title: "Join as a doctor", subtitle: "List your profile so patients can find you." },
  },
  forgot: { title: "Reset your password", subtitle: "We'll email you a code to confirm it's you." },
};

export default function AuthForm({ role }: { role: "USER" | "DOCTOR" }) {
  const redirectPath = useSearchParams().get("redirect");

  const { register, handleSubmit, reset, getValues, setError, formState: { errors, isSubmitting } } = useForm();
  const { currentUser, googleAuth, sendOTP, changePassword, signUp, signIn } = useUser();

  const [mode, setMode] = useState<Mode>("signin");
  const [isOtpPage, setIsOtpPage] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Runs once the emailed code has been confirmed
  const afterOtp = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (currentUser) enterApp(redirectPath);
  }, [currentUser, redirectPath]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setFormError(null);
    setNotice(null);
  };

  const requestOtp = (email: string, then: () => Promise<void>) => {
    afterOtp.current = then;
    setOtpError(null);
    setIsOtpPage(true);
    sendOTP(email).catch((err) => {
      console.error("Failed to send OTP:", err);
      setOtpError("We couldn't send the code. Email may not be set up on this server.");
    });
  };

  const onSubmit = async (data: any) => {
    setFormError(null);
    setNotice(null);
    const { email, password, name, hospital, confirmPassword } = data;

    if (mode === "signin") {
      const ok = await signIn(email, password);
      if (!ok) {
        setFormError("That email and password don't match.");
        return;
      }
      enterApp(redirectPath);
      return;
    }

    if (password !== confirmPassword) {
      setError("confirmPassword", { type: "manual", message: "Passwords do not match" });
      return;
    }

    if (mode === "forgot") {
      requestOtp(email, async () => {
        await changePassword(email, password);
        localStorage.removeItem("currentOtp");
        reset();
        setIsOtpPage(false);
        switchMode("signin");
        setNotice("Password updated. You can sign in now.");
      });
      return;
    }

    requestOtp(email, async () => {
      localStorage.removeItem("currentOtp");
      await signUp(email, password, name, { role, hospital });
      enterApp(redirectPath);
    });
  };

  const googlelogin = useGoogleLogin({
    onSuccess: async (cred: TokenResponse) => {
      const token = await googleAuth(cred.access_token);
      setAuthToken(token);
      localStorage.setItem("__Google_Access_Token__", cred.access_token);
      enterApp(redirectPath);
    },
    onError: () => setFormError("Google sign in didn't finish. Please try again."),
    scope: GOOGLE_SCOPE,
  });

  if (isOtpPage) {
    return (
      <OTPEntryPage
        email={getValues("email")}
        sendError={otpError}
        onResend={() => requestOtp(getValues("email"), afterOtp.current!)}
        onVerified={async () => {
          try {
            await afterOtp.current?.();
          } catch (err) {
            setIsOtpPage(false);
            setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
          }
        }}
        onBack={() => setIsOtpPage(false)}
      />
    );
  }

  const heading = mode === "forgot" ? copy.forgot : copy[role][mode];
  const Icon = mode === "forgot" ? KeyRound : mode === "signup" ? UserPlus : role === "DOCTOR" ? Stethoscope : LogIn;

  return (
    <AuthCard icon={Icon} title={heading.title} subtitle={heading.subtitle}>
      {role === "USER" && mode === "signin" && (
        <>
          <Button type="button" variant="outline" className="w-full" onClick={() => googlelogin()}>
            <svg viewBox="0 0 24 24" aria-hidden className="size-4">
              <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
              <path fill="#34A853" d="M12 23c3 0 5.4-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8C4 20.5 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.8 14.2c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V7H2.2C1.4 8.5 1 10.2 1 12s.4 3.5 1.2 5l3.6-2.8z" />
              <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.6l3.1-3.1C17.4 2.1 15 1 12 1 7.7 1 4 3.5 2.2 7l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
            </svg>
            Continue with Google
          </Button>
          <div className="my-5 flex items-center gap-3 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {mode === "signup" && (
          <Field label="Name">
            <input {...register("name")} autoComplete="name" required className={inputClass} />
          </Field>
        )}
        {mode === "signup" && role === "DOCTOR" && (
          <Field label="Hospital">
            <input {...register("hospital")} autoComplete="organization" required className={inputClass} />
          </Field>
        )}
        <Field label="Email">
          <input {...register("email")} type="email" autoComplete="username" required className={inputClass} />
        </Field>
        <Field label={mode === "forgot" ? "New password" : "Password"}>
          <input
            {...register("password")}
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            className={inputClass}
          />
        </Field>
        {mode !== "signin" && (
          <Field label="Confirm password">
            <input {...register("confirmPassword")} type="password" autoComplete="new-password" required className={inputClass} />
          </Field>
        )}

        {typeof errors.confirmPassword?.message === "string" && <FormAlert>{errors.confirmPassword.message}</FormAlert>}
        {formError && <FormAlert>{formError}</FormAlert>}
        {notice && <FormAlert tone="success">{notice}</FormAlert>}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "One moment..." : mode === "forgot" ? "Send code" : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
        {mode === "signin" ? (
          <>
            <button type="button" onClick={() => switchMode("forgot")} className="hover:text-foreground">
              Forgot your password?
            </button>
            <p>
              New here?{" "}
              <button type="button" onClick={() => switchMode("signup")} className="font-medium text-brand hover:underline">
                Create an account
              </button>
            </p>
          </>
        ) : (
          <button type="button" onClick={() => switchMode("signin")} className="font-medium text-brand hover:underline">
            Back to sign in
          </button>
        )}
      </div>
    </AuthCard>
  );
}
