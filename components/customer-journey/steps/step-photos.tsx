"use client";

import { useCallback, useRef, useState } from "react";
import { getStepNumber, getTotalSteps } from "@/lib/customer-journey/journey-state";
import { useJourney } from "@/lib/customer-journey/journey-provider";
import { JourneyContinueButton } from "@/components/customer-journey/layout/journey-continue-button";
import {
  CameraIcon,
  UploadIcon,
} from "@/components/customer-journey/ui/journey-icons";
import {
  JourneyHelperBox,
  JourneyStepHeader,
} from "@/components/customer-journey/ui/journey-ui";

export function StepPhotos() {
  const { state, goNext, goBack, addPhotos, removePhoto } = useJourney();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const hasPhotos = state.formData.photos.length > 0;

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) {
        return;
      }

      const imageFiles = Array.from(files).filter((file) =>
        file.type.startsWith("image/")
      );

      if (imageFiles.length) {
        addPhotos(imageFiles);
      }
    },
    [addPhotos]
  );

  return (
    <div className="cj-step">
      <JourneyStepHeader
        stepNumber={getStepNumber("photos")}
        totalSteps={getTotalSteps()}
        title="Got any photos?"
        description="A quick snap of the area helps — but you can skip this entirely."
      />

      <div
        className={[
          "cj-upload-zone",
          dragActive ? "cj-upload-zone-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <UploadIcon className="cj-upload-icon" />
        <p className="cj-upload-title">Add photos if you have them</p>
        <p className="cj-upload-subtitle">Drag & drop, upload, or take a photo</p>
        <div className="cj-upload-actions">
          <button
            type="button"
            className="cj-btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon className="cj-btn-secondary-icon" />
            Choose photos
          </button>
          <button
            type="button"
            className="cj-btn-secondary"
            onClick={() => cameraInputRef.current?.click()}
          >
            <CameraIcon className="cj-btn-secondary-icon" />
            Take a photo
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="cj-hidden-input"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="cj-hidden-input"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      {hasPhotos ? (
        <ul className="cj-photo-list">
          {state.formData.photos.map((file, index) => (
            <li key={`${file.name}-${index}`} className="cj-photo-item">
              <span className="cj-photo-name">{file.name}</span>
              <button
                type="button"
                className="cj-photo-remove"
                onClick={() => removePhoto(index)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <JourneyHelperBox title="No photos? That's fine">
        <p>
          John can take a look when he visits. Tap &ldquo;Skip for now&rdquo; below
          to carry on.
        </p>
      </JourneyHelperBox>

      <JourneyContinueButton
        onClick={goNext}
        onBack={goBack}
        showBack
        label={hasPhotos ? "Continue" : "Skip for now"}
        hint={hasPhotos ? "Looking good" : "You can add photos later"}
      />
    </div>
  );
}
