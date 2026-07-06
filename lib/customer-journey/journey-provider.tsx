"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { PLACEHOLDER_TRADESPERSON } from "./constants";
import {
  canProceed,
  getNextStepId,
  getPreviousStepId,
  INITIAL_FORM_DATA,
  journeyReducer,
  type JourneyState,
} from "./journey-state";
import type { JourneyFormData, JourneyStepId, TradeType, TradespersonInfo } from "./types";

type JourneyContextValue = {
  state: JourneyState;
  tradesperson: TradespersonInfo;
  setStep: (stepId: JourneyStepId) => void;
  updateField: <K extends keyof JourneyFormData>(
    field: K,
    value: JourneyFormData[K]
  ) => void;
  setTradeAnswer: (questionId: string, value: string) => void;
  selectTradeAndContinue: (trade: TradeType) => void;
  declineMeasurementsAndContinue: () => void;
  addPhotos: (files: File[]) => void;
  removePhoto: (index: number) => void;
  goNext: () => void;
  goBack: () => void;
  canContinue: boolean;
  submit: () => void;
};

const JourneyContext = createContext<JourneyContextValue | null>(null);

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(journeyReducer, {
    currentStepId: "trade" as JourneyStepId,
    formData: {
      ...INITIAL_FORM_DATA,
      measurements: INITIAL_FORM_DATA.measurements.map((field) => ({ ...field })),
    },
    submitted: false,
  });

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

  const selectTradeAndContinue = useCallback((trade: TradeType) => {
    dispatch({ type: "SELECT_TRADE_AND_CONTINUE", trade });
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
    const next = getNextStepId(state.currentStepId);

    if (state.currentStepId === "review") {
      dispatch({ type: "SET_STEP", stepId: "thank_you" });
      return;
    }

    dispatch({ type: "SET_STEP", stepId: next });
  }, [state.currentStepId]);

  const goBack = useCallback(() => {
    const previous = getPreviousStepId(state.currentStepId);

    if (previous) {
      dispatch({ type: "SET_STEP", stepId: previous });
    }
  }, [state.currentStepId]);

  const submit = useCallback(() => {
    dispatch({ type: "SET_STEP", stepId: "thank_you" });
  }, []);

  const canContinue = canProceed(state.currentStepId, state.formData);

  const value = useMemo(
    () => ({
      state,
      tradesperson: PLACEHOLDER_TRADESPERSON,
      setStep,
      updateField,
      setTradeAnswer,
      selectTradeAndContinue,
      declineMeasurementsAndContinue,
      addPhotos,
      removePhoto,
      goNext,
      goBack,
      canContinue,
      submit,
    }),
    [
      state,
      setStep,
      updateField,
      setTradeAnswer,
      selectTradeAndContinue,
      declineMeasurementsAndContinue,
      addPhotos,
      removePhoto,
      goNext,
      goBack,
      canContinue,
      submit,
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
