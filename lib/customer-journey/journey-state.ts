import {
  DEFAULT_MEASUREMENT_FIELDS,
  JOURNEY_STEPS,
} from "./constants";
import { getRequiredTradeQuestions } from "./trade-questions";
import type {
  JourneyFormData,
  JourneyStepId,
  MeasurementField,
} from "./types";

export const INITIAL_FORM_DATA: JourneyFormData = {
  trade: null,
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

export function getStepIndex(stepId: JourneyStepId): number {
  if (stepId === "thank_you") {
    return JOURNEY_STEPS.length;
  }

  return JOURNEY_STEPS.findIndex((step) => step.id === stepId);
}

export function getStepNumber(stepId: JourneyStepId): number {
  const index = getStepIndex(stepId);

  return index >= 0 ? index + 1 : JOURNEY_STEPS.length + 1;
}

export function getTotalSteps(): number {
  return JOURNEY_STEPS.length;
}

export function canProceed(stepId: JourneyStepId, data: JourneyFormData): boolean {
  switch (stepId) {
    case "trade":
      return data.trade !== null;
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
      const questions = getRequiredTradeQuestions(data.trade);

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

export function getNextStepId(stepId: JourneyStepId): JourneyStepId {
  const index = getStepIndex(stepId);

  if (index < 0 || index >= JOURNEY_STEPS.length - 1) {
    return "thank_you";
  }

  return JOURNEY_STEPS[index + 1].id;
}

export function getPreviousStepId(stepId: JourneyStepId): JourneyStepId | null {
  const index = getStepIndex(stepId);

  if (index <= 0) {
    return null;
  }

  return JOURNEY_STEPS[index - 1].id;
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
  | { type: "SELECT_TRADE_AND_CONTINUE"; trade: JourneyFormData["trade"] }
  | { type: "DECLINE_MEASUREMENTS_AND_CONTINUE" }
  | { type: "RESET" };

export type JourneyState = {
  currentStepId: JourneyStepId;
  formData: JourneyFormData;
  submitted: boolean;
};

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
        },
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
    case "SELECT_TRADE_AND_CONTINUE":
      return {
        ...state,
        currentStepId: "details",
        formData: {
          ...state.formData,
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
      return {
        currentStepId: "trade",
        formData: {
          ...INITIAL_FORM_DATA,
          measurements: DEFAULT_MEASUREMENT_FIELDS.map(
            (field): MeasurementField => ({ ...field })
          ),
        },
        submitted: false,
      };
    default:
      return state;
  }
}
