"use client";

import { useActionState, useState } from "react";
import { completeOnboarding, type OnboardingActionState } from "@/app/onboarding/actions";
import { AuthError } from "@/components/auth/auth-shell";
import {
  OnboardingField,
  OnboardingSelect,
  OnboardingTextarea,
} from "@/components/onboarding/form-fields";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import {
  DEFAULT_PAYMENT_TERMS,
  HEARD_ABOUT_OPTIONS,
  TRADE_TYPES,
} from "@/lib/onboarding/constants";

const initialState: OnboardingActionState = {};

const TOTAL_STEPS = 3;

const stepCopy = {
  1: {
    title: "Tell us about you",
    subtitle: "A few quick details so QuoteForge feels like your business from day one.",
  },
  2: {
    title: "Your business details",
    subtitle: "These appear on your proposals so customers know who they are dealing with.",
  },
  3: {
    title: "One last thing",
    subtitle: "This helps us understand how tradespeople are finding QuoteForge.",
  },
} as const;

export function OnboardingForm() {
  const [step, setStep] = useState(1);
  const [state, formAction, isPending] = useActionState(completeOnboarding, initialState);

  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [tradeType, setTradeType] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState(DEFAULT_PAYMENT_TERMS);
  const [heardAbout, setHeardAbout] = useState("");

  const { title, subtitle } = stepCopy[step as keyof typeof stepCopy];

  function canContinueFromStep(currentStep: number): boolean {
    if (currentStep === 1) {
      return Boolean(fullName.trim() && businessName.trim() && tradeType);
    }

    if (currentStep === 2) {
      return Boolean(businessEmail.trim() && phone.trim() && defaultPaymentTerms.trim());
    }

    return Boolean(heardAbout);
  }

  return (
    <OnboardingShell step={step} totalSteps={TOTAL_STEPS} title={title} subtitle={subtitle}>
      <form action={formAction} className="space-y-5">
        {state.error ? <AuthError message={state.error} /> : null}

        {step === 1 ? (
          <>
            <OnboardingField
              label="Full name"
              id="fullName"
              name="fullName"
              value={fullName}
              onChange={setFullName}
              autoComplete="name"
            />
            <OnboardingField
              label="Business name"
              id="businessName"
              name="businessName"
              value={businessName}
              onChange={setBusinessName}
              autoComplete="organization"
            />
            <OnboardingSelect
              label="Trade type"
              id="tradeType"
              name="tradeType"
              value={tradeType}
              onChange={setTradeType}
              options={TRADE_TYPES}
              placeholder="Choose your trade"
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <OnboardingField
              label="Business email"
              id="businessEmail"
              name="businessEmail"
              type="email"
              value={businessEmail}
              onChange={setBusinessEmail}
              autoComplete="email"
            />
            <OnboardingField
              label="Phone number"
              id="phone"
              name="phone"
              type="tel"
              value={phone}
              onChange={setPhone}
              autoComplete="tel"
            />
            <OnboardingField
              label="VAT number"
              id="vatNumber"
              name="vatNumber"
              value={vatNumber}
              onChange={setVatNumber}
              required={false}
              placeholder="Optional"
            />
            <OnboardingTextarea
              label="Default payment terms"
              id="defaultPaymentTerms"
              name="defaultPaymentTerms"
              value={defaultPaymentTerms}
              onChange={setDefaultPaymentTerms}
            />
          </>
        ) : null}

        {step === 3 ? (
          <OnboardingSelect
            label="How did you hear about QuoteForge?"
            id="heardAbout"
            name="heardAbout"
            value={heardAbout}
            onChange={setHeardAbout}
            options={HEARD_ABOUT_OPTIONS}
            placeholder="Choose one"
          />
        ) : null}

        {/* Hidden fields keep earlier step values in the form submission */}
        {step > 1 ? (
          <>
            <input type="hidden" name="fullName" value={fullName} />
            <input type="hidden" name="businessName" value={businessName} />
            <input type="hidden" name="tradeType" value={tradeType} />
          </>
        ) : null}
        {step > 2 ? (
          <>
            <input type="hidden" name="businessEmail" value={businessEmail} />
            <input type="hidden" name="phone" value={phone} />
            <input type="hidden" name="vatNumber" value={vatNumber} />
            <input type="hidden" name="defaultPaymentTerms" value={defaultPaymentTerms} />
          </>
        ) : null}

        <div className="flex items-center justify-between gap-3 pt-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((current) => current - 1)}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border-subtle px-5 text-sm font-medium text-foreground transition-colors hover:bg-background"
            >
              Back
            </button>
          ) : (
            <span />
          )}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={() => setStep((current) => current + 1)}
              disabled={!canContinueFromStep(step)}
              className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-black transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canContinueFromStep(step) || isPending}
              className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-black transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Setting up…" : "Finish setup"}
            </button>
          )}
        </div>
      </form>
    </OnboardingShell>
  );
}
