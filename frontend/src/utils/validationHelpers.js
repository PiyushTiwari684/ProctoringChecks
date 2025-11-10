/**
 * Validation Helpers for Face Detection
 *
 * Provides functions to validate face positioning, size, and quality
 * Used by both WebCam verification and future proctoring features
 */


export function isFaceCentered(face, videoWidth, videoHeight, tolerance = 0.2) {
  const faceCenterX = (face.topLeft[0] + face.bottomRight[0]) / 2;
  const faceCenterY = (face.topLeft[1] + face.bottomRight[1]) / 2;

  const videoCenterX = videoWidth / 2;
  const videoCenterY = videoHeight / 2;

  const offsetX = Math.abs(faceCenterX - videoCenterX) / videoWidth;
  const offsetY = Math.abs(faceCenterY - videoCenterY) / videoHeight;

  return offsetX < tolerance && offsetY < tolerance;
}


export function isFaceProperSize(
  face,
  videoWidth,
  videoHeight,
  minSize = 0.15,
  maxSize = 0.50
) {
  const faceWidth = face.bottomRight[0] - face.topLeft[0];
  const faceHeight = face.bottomRight[1] - face.topLeft[1];

  const faceArea = faceWidth * faceHeight;
  const videoArea = videoWidth * videoHeight;

  const facePercentage = faceArea / videoArea;

  return facePercentage >= minSize && facePercentage <= maxSize;
}


export function getFaceSizePercentage(face, videoWidth, videoHeight) {
  const faceWidth = face.bottomRight[0] - face.topLeft[0];
  const faceHeight = face.bottomRight[1] - face.topLeft[1];
  const faceArea = faceWidth * faceHeight;
  const videoArea = videoWidth * videoHeight;
  return faceArea / videoArea;
}


export function hasGoodConfidence(face, threshold = 0.7) {
  return face.probability >= threshold;
}

export function getPositioningHints(face, videoWidth, videoHeight) {
  const faceCenterX = (face.topLeft[0] + face.bottomRight[0]) / 2;
  const faceCenterY = (face.topLeft[1] + face.bottomRight[1]) / 2;

  const videoCenterX = videoWidth / 2;
  const videoCenterY = videoHeight / 2;

  const offsetX = (faceCenterX - videoCenterX) / videoWidth;
  const offsetY = (faceCenterY - videoCenterY) / videoHeight;

  let horizontal = 'centered';
  let vertical = 'centered';

  if (offsetX < -0.2) horizontal = 'move right';
  else if (offsetX > 0.2) horizontal = 'move left';

  if (offsetY < -0.2) vertical = 'move down';
  else if (offsetY > 0.2) vertical = 'move up';

  return { horizontal, vertical };
}

/**
 * Validation status codes
 */
export const ValidationStatus = {
  VALID: 'VALID',
  NO_FACE: 'NO_FACE',
  MULTIPLE_FACES: 'MULTIPLE_FACES',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  NOT_CENTERED: 'NOT_CENTERED',
  TOO_FAR: 'TOO_FAR',
  TOO_CLOSE: 'TOO_CLOSE'
};

/**
 * Get comprehensive validation status
 * @param {Array} faces - Array of detected faces from BlazeFace
 * @param {number} videoWidth - Video width in pixels
 * @param {number} videoHeight - Video height in pixels
 * @returns {Object} Validation result { isValid, status, message, icon }
 */
export function getValidationStatus(faces, videoWidth, videoHeight) {
  // No face detected
  if (faces.length === 0) {
    return {
      isValid: false,
      status: ValidationStatus.NO_FACE,
      message: 'No face detected. Please position yourself in front of camera.',
      icon: '❌'
    };
  }

  // Multiple faces detected
  if (faces.length > 1) {
    return {
      isValid: false,
      status: ValidationStatus.MULTIPLE_FACES,
      message: `Multiple faces detected (${faces.length}). Ensure only you are visible.`,
      icon: '⚠️'
    };
  }

  const face = faces[0];

  // Low confidence
  if (!hasGoodConfidence(face)) {
    return {
      isValid: false,
      status: ValidationStatus.LOW_CONFIDENCE,
      message: 'Face not clear. Ensure good lighting and face the camera.',
      icon: '💡'
    };
  }

  // Face not centered
  if (!isFaceCentered(face, videoWidth, videoHeight)) {
    const hints = getPositioningHints(face, videoWidth, videoHeight);
    let message = 'Please center your face.';

    if (hints.horizontal !== 'centered' || hints.vertical !== 'centered') {
      const directions = [];
      if (hints.horizontal !== 'centered') directions.push(hints.horizontal);
      if (hints.vertical !== 'centered') directions.push(hints.vertical);
      message = `Please ${directions.join(' and ')}.`;
    }

    return {
      isValid: false,
      status: ValidationStatus.NOT_CENTERED,
      message,
      icon: '🎯'
    };
  }

  // Face size validation
  if (!isFaceProperSize(face, videoWidth, videoHeight)) {
    const facePercentage = getFaceSizePercentage(face, videoWidth, videoHeight);

    if (facePercentage < 0.15) {
      return {
        isValid: false,
        status: ValidationStatus.TOO_FAR,
        message: 'Move closer to the camera.',
        icon: '📏'
      };
    } else {
      return {
        isValid: false,
        status: ValidationStatus.TOO_CLOSE,
        message: 'Move back from the camera.',
        icon: '📏'
      };
    }
  }

  // All validations passed
  return {
    isValid: true,
    status: ValidationStatus.VALID,
    message: 'Perfect! Face detected and positioned correctly.',
    icon: '✅'
  };
}

/**
 * Calculate guide box dimensions (ideal face position overlay)
 * @param {number} videoWidth - Video width in pixels
 * @param {number} videoHeight - Video height in pixels
 * @returns {Object} Guide box { x, y, width, height }
 */
export function getGuideBoxDimensions(videoWidth, videoHeight) {
  // Guide box should be ~40% of video area, centered
  const guideWidth = videoWidth * 0.5;
  const guideHeight = videoHeight * 0.65;
  const x = (videoWidth - guideWidth) / 2;
  const y = (videoHeight - guideHeight) / 2;

  return { x, y, width: guideWidth, height: guideHeight };
}

/**
 * Check if face is within guide box
 * @param {Object} face - Face object from BlazeFace
 * @param {Object} guideBox - Guide box dimensions
 * @returns {boolean}
 */
export function isFaceInGuideBox(face, guideBox) {
  const faceLeft = face.topLeft[0];
  const faceTop = face.topLeft[1];
  const faceRight = face.bottomRight[0];
  const faceBottom = face.bottomRight[1];

  const guideLeft = guideBox.x;
  const guideTop = guideBox.y;
  const guideRight = guideBox.x + guideBox.width;
  const guideBottom = guideBox.y + guideBox.height;

  // Check if face is mostly within guide box (with some tolerance)
  const tolerance = 20; // pixels
  return (
    faceLeft >= guideLeft - tolerance &&
    faceTop >= guideTop - tolerance &&
    faceRight <= guideRight + tolerance &&
    faceBottom <= guideBottom + tolerance
  );
}
