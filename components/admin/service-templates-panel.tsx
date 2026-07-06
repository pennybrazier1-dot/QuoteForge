"use client";

import { useMemo, useState } from "react";
import { AdminSection } from "@/components/admin/admin-section";
import { resolveServiceTradeType } from "@/lib/customer-journey/business-services";
import { TRADE_OPTIONS } from "@/lib/customer-journey/constants";
import { getTradeQuestions } from "@/lib/customer-journey/trade-questions";
import type { TradeQuestion } from "@/lib/customer-journey/types";

type ServiceTemplatesPanelProps = {
  serviceLabels: string[];
};

function cloneQuestions(questions: TradeQuestion[]): TradeQuestion[] {
  return questions.map((question) => ({ ...question }));
}

export function ServiceTemplatesPanel({ serviceLabels }: ServiceTemplatesPanelProps) {
  const options = useMemo(() => {
    const labels = new Set(serviceLabels);
    for (const trade of TRADE_OPTIONS) {
      labels.add(trade.label);
    }
    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [serviceLabels]);

  const [selectedLabel, setSelectedLabel] = useState(options[0] ?? "");
  const [drafts, setDrafts] = useState<Record<string, TradeQuestion[]>>({});

  const templateTradeType = resolveServiceTradeType(selectedLabel);
  const sourceQuestions = getTradeQuestions(templateTradeType);
  const questions = drafts[selectedLabel] ?? sourceQuestions;

  function updateQuestionLabel(questionId: string, label: string) {
    setDrafts((current) => {
      const base = current[selectedLabel] ?? cloneQuestions(sourceQuestions);
      return {
        ...current,
        [selectedLabel]: base.map((question) =>
          question.id === questionId ? { ...question, label } : question
        ),
      };
    });
  }

  function resetDraft() {
    setDrafts((current) => {
      const next = { ...current };
      delete next[selectedLabel];
      return next;
    });
  }

  const hasLocalEdits = Boolean(drafts[selectedLabel]);

  return (
    <AdminSection
      title="Service Templates"
      description="Customer enquiry questions attached to each trade or service."
    >
      <div className="qf-admin-template-toolbar">
        <label htmlFor="admin-template-select" className="qf-admin-field-label">
          View template for
        </label>
        <select
          id="admin-template-select"
          className="form-select qf-admin-template-select"
          value={selectedLabel}
          onChange={(event) => setSelectedLabel(event.target.value)}
        >
          {options.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        <p className="qf-admin-template-meta">
          Uses template key{" "}
          <code className="qf-admin-code">{templateTradeType}</code>
          {hasLocalEdits ? " · local edits active" : null}
        </p>
      </div>

      <ol className="qf-admin-question-list">
        {questions.map((question, index) => (
          <li key={question.id} className="qf-admin-question-item">
            <div className="qf-admin-question-header">
              <span className="qf-admin-question-index">Q{index + 1}</span>
              <span className="qf-admin-question-type">{question.type}</span>
              {question.required === false ? (
                <span className="qf-admin-question-optional">Optional</span>
              ) : null}
            </div>

            <label
              htmlFor={`admin-question-${question.id}`}
              className="qf-admin-field-label"
            >
              Question label
            </label>
            <input
              id={`admin-question-${question.id}`}
              type="text"
              className="form-input"
              value={question.label}
              onChange={(event) =>
                updateQuestionLabel(question.id, event.target.value)
              }
            />

            {question.helperText ? (
              <p className="qf-admin-question-helper">{question.helperText}</p>
            ) : null}

            {question.options?.length ? (
              <ul className="qf-admin-question-options">
                {question.options.map((option) => (
                  <li key={option}>{option}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="qf-admin-template-actions">
        <button
          type="button"
          className="qf-btn-secondary"
          onClick={resetDraft}
          disabled={!hasLocalEdits}
        >
          Reset local edits
        </button>
        <p className="qf-admin-local-note">
          Editing is placeholder UI only — changes stay in this browser session.
        </p>
      </div>
    </AdminSection>
  );
}
