"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import {
  JOURNEY_PREVIEW_PROFILES,
  type JourneyPreviewProfileId,
} from "./constants";
import { resolveServiceTradeType } from "./business-services";
import { persistEnquiryFromJourney } from "@/lib/enquiries/enquiry-store";
import {
  canProceed,
  createInitialState,
  getNextStepId,
  getPreviousStepId,
  journeyReducer,
  type JourneyState,
} from "./journey-state";
import type { JourneyFormData, JourneyStepId, TradespersonInfo } from "./types";

type JourneyContextValue = {
  state: JourneyState;
  tradesperson: TradespersonInfo;
  activePreviewProfileId: JourneyPreviewProfileId;
  switchPreviewProfile: (profileId: JourneyPreviewProfileId) => void;
  setStep: (stepId: JourneyStepId) => void;
  updateField: <K extends keyof JourneyFormData>(
    field: K,
    value: JourneyFormData[K]
  ) => void;
  setTradeAnswer: (questionId: string, value: string) => void;
  selectServiceAndContinue: (service: string) => void;
  declineMeasurementsAndContinue: () => void;
  addPhotos: (files: File[]) => void;
  removePhoto: (index: number) => void;
  goNext: () => void;
  goBack: () => void;
  canContinue: boolean;
  submit: () => Promise<void>;
  isSubmitting: boolean;
};

const JourneyContext = createContext<JourneyContextValue | null>(null);

type JourneyProviderProps = {
  children: ReactNode;
  initialProfileId?: JourneyPreviewProfileId;
};

export function JourneyProvider({
  children,
  initialProfileId = "single-trade",
}: JourneyProviderProps) {
  const [activePreviewProfileId, setActivePreviewProfileId] =
    useState<JourneyPreviewProfileId>(initialProfileId);
  const [tradesperson, setTradesperson] = useState<TradespersonInfo>(
    () => JOURNEY_PREVIEW_PROFILES[initialProfileId].tradesperson
  );

  const [state, dispatch] = useReducer(
    journeyReducer,
    tradesperson,
    createInitialState
  );

  const switchPreviewProfile = useCallback((profileId: JourneyPreviewProfileId) => {
    const profile = JOURNEY_PREVIEW_PROFILES[profileId].tradesperson;
    setActivePreviewProfileId(profileId);
    setTradesperson(profile);
    dispatch({ type: "RESET", tradesperson: profile });
  }, []);

  const setStep = useCallback((stepId: JourneyStepId) => {
    dispatch({ type: "SET_STEP", stepId });
  }, []);

  const updateField = useCallback(
    <K extends keyof JourneyFormData>(field: K, value: JourneyFormData[K]) => {
      if (field === "trade") {
        dispatch({ type: "SET_TRADE", trade: value as JourneyFormData["trade"] });
        return;
      }

      if (field === "knowsMeasurements") {
        dispatch({
          type: "SET_MEASUREMENTS_KNOWN",
          value: value as JourneyFormData["knowsMeasurements"],
        });
        return;
      }

      dispatch({ type: "SET_FIELD", field, value });
    },
    []
  );

  const setTradeAnswer = useCallback((questionId: string, value: string) => {
    dispatch({ type: "SET_TRADE_ANSWER", questionId, value });
  }, []);

  const selectServiceAndContinue = useCallback((service: string) => {
    dispatch({
      type: "SELECT_SERVICE_AND_CONTINUE",
      service,
      trade: resolveServiceTradeType(service),
    });
  }, []);

  const declineMeasurementsAndContinue = useCallback(() => {
    dispatch({ type: "DECLINE_MEASUREMENTS_AND_CONTINUE" });
  }, []);

  const addPhotos = useCallback((files: File[]) => {
    dispatch({ type: "ADD_PHOTOS", files });
  }, []);

  const removePhoto = useCallback((index: number) => {
    dispatch({ type: "REMOVE_PHOTO", index });
  }, []);

  const goNext = useCallback(() => {
    const next = getNextStepId(state.currentStepId, tradesperson);
    dispatch({ type: "SET_STEP", stepId: next });
  }, [state.currentStepId, tradesperson]);

  const goBack = useCallback(() => {
    const previous = getPreviousStepId(state.currentStepId, tradesperson);

    if (previous) {
      dispatch({ type: "SET_STEP", stepId: previous });
    }
  }, [state.currentStepId, tradesperson]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await persistEnquiryFromJourney(state.formData, tradesperson);
      dispatch({ type: "SET_STEP", stepId: "thank_you" });
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, state.formData, tradesperson]);

  const canContinue = canProceed(state.currentStepId, state.formData, tradesperson);

  const value = useMemo(
    () => ({
      state,
      tradesperson,
      activePreviewProfileId,
      switchPreviewProfile,
      setStep,
      updateField,
      setTradeAnswer,
      selectServiceAndContinue,
      declineMeasurementsAndContinue,
      addPhotos,
      removePhoto,
      goNext,
      goBack,
      canContinue,
      submit,
      isSubmitting,
    }),
    [
      state,
      tradesperson,
      activePreviewProfileId,
      switchPreviewProfile,
      setStep,
      updateField,
      setTradeAnswer,
      selectServiceAndContinue,
      declineMeasurementsAndContinue,
      addPhotos,
      removePhoto,
      goNext,
      goBack,
      canContinue,
      submit,
      isSubmitting,
    ]
  );

  return (
    <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>
  );
}

export function useJourney(): JourneyContextValue {
  const context = useContext(JourneyContext);

  if (!context) {
    throw new Error("useJourney must be used within JourneyProvider");
  }

  return context;
}
