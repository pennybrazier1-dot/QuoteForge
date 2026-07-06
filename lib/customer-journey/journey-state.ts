import {
  DEFAULT_MEASUREMENT_FIELDS,
  getJourneySteps,
} from "./constants";
import { getPrimaryServiceLabel, needsServiceSelection } from "./business-services";
import { getRequiredTradeQuestions } from "./trade-questions";
import type {
  JourneyFormData,
  JourneyStepId,
  TradeType,
  TradespersonInfo,
} from "./types";

export const INITIAL_FORM_DATA: JourneyFormData = {
  trade: null,
  selectedService: null,
  name: "",
  mobile: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postcode: "",
  propertyType: null,
  projectDescription: "",
  photos: [],
  knowsMeasurements: null,
  measurements: DEFAULT_MEASUREMENT_FIELDS.map((field) => ({ ...field })),
  tradeAnswers: {},
};

export function getEffectiveTrade(
  data: JourneyFormData,
  tradesperson: TradespersonInfo
): TradeType {
  return data.trade ?? tradesperson.tradeType;
}

export type JourneyState = {
  currentStepId: JourneyStepId;
  formData: JourneyFormData;
  submitted: boolean;
};

export function createInitialState(tradesperson: TradespersonInfo): JourneyState {
  const presetService = getPrimaryServiceLabel(tradesperson);

  return {
    currentStepId: "welcome",
    formData: {
      ...INITIAL_FORM_DATA,
      trade: needsServiceSelection(tradesperson) ? null : tradesperson.tradeType,
      selectedService: needsServiceSelection(tradesperson) ? null : presetService,
      measurements: DEFAULT_MEASUREMENT_FIELDS.map((field) => ({ ...field })),
    },
    submitted: false,
  };
}

export function getStepIndex(
  stepId: JourneyStepId,
  tradesperson: TradespersonInfo
): number {
  const steps = getJourneySteps(tradesperson);

  if (stepId === "thank_you") {
    return steps.length;
  }

  return steps.findIndex((step) => step.id === stepId);
}

export function getStepNumber(
  stepId: JourneyStepId,
  tradesperson: TradespersonInfo
): number {
  const index = getStepIndex(stepId, tradesperson);

  return index >= 0 ? index + 1 : getJourneySteps(tradesperson).length + 1;
}

export function getTotalSteps(tradesperson: TradespersonInfo): number {
  return getJourneySteps(tradesperson).length;
}

export function canProceed(
  stepId: JourneyStepId,
  data: JourneyFormData,
  tradesperson: TradespersonInfo
): boolean {
  switch (stepId) {
    case "welcome":
      return true;
    case "work_type":
      return data.selectedService !== null && data.trade !== null;
    case "details":
      return (
        data.name.trim().length >= 2 && data.mobile.trim().length >= 7
      );
    case "property":
      return (
        data.addressLine1.trim().length >= 3 &&
        data.postcode.trim().length >= 3 &&
        data.propertyType !== null
      );
    case "project":
      return data.projectDescription.trim().length >= 8;
    case "photos":
      return true;
    case "measurements":
      return data.knowsMeasurements !== null;
    case "trade_questions": {
      const trade = getEffectiveTrade(data, tradesperson);
      const questions = getRequiredTradeQuestions(trade);

      return questions.every((question) =>
        Boolean(data.tradeAnswers[question.id]?.trim())
      );
    }
    case "review":
      return true;
    case "thank_you":
      return true;
    default:
      return false;
  }
}

export function getNextStepId(
  stepId: JourneyStepId,
  tradesperson: TradespersonInfo
): JourneyStepId {
  const steps = getJourneySteps(tradesperson);
  const index = getStepIndex(stepId, tradesperson);

  if (index < 0 || index >= steps.length - 1) {
    return "thank_you";
  }

  return steps[index + 1].id;
}

export function getPreviousStepId(
  stepId: JourneyStepId,
  tradesperson: TradespersonInfo
): JourneyStepId | null {
  const index = getStepIndex(stepId, tradesperson);

  if (index <= 0) {
    return null;
  }

  return getJourneySteps(tradesperson)[index - 1].id;
}

export type JourneyAction =
  | { type: "SET_STEP"; stepId: JourneyStepId }
  | { type: "SET_TRADE"; trade: JourneyFormData["trade"] }
  | { type: "SET_FIELD"; field: keyof JourneyFormData; value: JourneyFormData[keyof JourneyFormData] }
  | { type: "SET_TRADE_ANSWER"; questionId: string; value: string }
  | { type: "SET_MEASUREMENTS_KNOWN"; value: JourneyFormData["knowsMeasurements"] }
  | { type: "SET_MEASUREMENT"; id: string; value: string }
  | { type: "ADD_PHOTOS"; files: File[] }
  | { type: "REMOVE_PHOTO"; index: number }
  | { type: "SELECT_SERVICE_AND_CONTINUE"; service: string; trade: TradeType }
  | { type: "DECLINE_MEASUREMENTS_AND_CONTINUE" }
  | { type: "RESET"; tradesperson: TradespersonInfo };

export function journeyReducer(
  state: JourneyState,
  action: JourneyAction
): JourneyState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStepId: action.stepId };
    case "SET_TRADE":
      return {
        ...state,
        formData: {
          ...state.formData,
          trade: action.trade,
          tradeAnswers: {},
        },
      };
    case "SET_FIELD":
      return {
        ...state,
        formData: {
          ...state.formData,
          [action.field]: action.value,
        } as JourneyFormData,
      };
    case "SET_TRADE_ANSWER":
      return {
        ...state,
        formData: {
          ...state.formData,
          tradeAnswers: {
            ...state.formData.tradeAnswers,
            [action.questionId]: action.value,
          },
        },
      };
    case "SET_MEASUREMENTS_KNOWN":
      return {
        ...state,
        formData: {
          ...state.formData,
          knowsMeasurements: action.value,
        },
      };
    case "SET_MEASUREMENT":
      return {
        ...state,
        formData: {
          ...state.formData,
          measurements: state.formData.measurements.map((field) =>
            field.id === action.id ? { ...field, value: action.value } : field
          ),
        },
      };
    case "ADD_PHOTOS":
      return {
        ...state,
        formData: {
          ...state.formData,
          photos: [...state.formData.photos, ...action.files],
        },
      };
    case "REMOVE_PHOTO":
      return {
        ...state,
        formData: {
          ...state.formData,
          photos: state.formData.photos.filter((_, index) => index !== action.index),
        },
      };
    case "SELECT_SERVICE_AND_CONTINUE":
      return {
        ...state,
        currentStepId: "details",
        formData: {
          ...state.formData,
          selectedService: action.service,
          trade: action.trade,
          tradeAnswers: {},
        },
      };
    case "DECLINE_MEASUREMENTS_AND_CONTINUE":
      return {
        ...state,
        currentStepId: "trade_questions",
        formData: {
          ...state.formData,
          knowsMeasurements: "no",
        },
      };
    case "RESET":
      return createInitialState(action.tradesperson);
    default:
      return state;
  }
}
