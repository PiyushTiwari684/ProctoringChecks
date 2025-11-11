import { useEffect, useRef, useCallback, useState } from 'react';
import { useFaceDetection } from './useFaceDetection';
import { useProctorContext } from '../context/ProctorContext';

/**
 * Custom hook for continuous webcam monitoring during assessment
 * Detects no face, multiple faces, and other anomalies
 */
export function useWebcamMonitoring({
  enabled = false,
  interval = 5000, // Check every 5 seconds
  noFaceThreshold = 10000, // Warn after 10 seconds of no face
  criticalNoFaceThreshold = 30000, // Critical after 30 seconds
  onWarning,
  onCritical
} = {}) {
  const { logViolation, ViolationType } = useProctorContext();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const noFaceStartTimeRef = useRef(null);
  const checkIntervalRef = useRef(null);
  const lastViolationTimeRef = useRef({});

  // Use the existing face detection hook
  const {
    faces,
    isDetecting,
    validationStatus,
    startDetection,
    stopDetection
  } = useFaceDetection({
    enabled: false, // We'll control it manually
    interval: 1000 // Check more frequently for monitoring
  });

  /**
   * Check face status and log violations
   */
  const checkFaceStatus = useCallback(() => {
    if (!enabled || !isDetecting) return;

    const now = Date.now();

    // NO FACE DETECTED
    if (!faces || faces.length === 0) {
      if (!noFaceStartTimeRef.current) {
        noFaceStartTimeRef.current = now;
      }

      const noFaceDuration = now - noFaceStartTimeRef.current;

      // Warn after threshold
      if (noFaceDuration >= noFaceThreshold) {
        // Only log once per 5 seconds to avoid spam
        const lastLog = lastViolationTimeRef.current[ViolationType.NO_FACE_DETECTED] || 0;
        if (now - lastLog >= 5000) {
          logViolation(ViolationType.NO_FACE_DETECTED, {
            duration: Math.floor(noFaceDuration / 1000),
            timestamp: new Date().toISOString()
          });

          lastViolationTimeRef.current[ViolationType.NO_FACE_DETECTED] = now;

          if (onWarning) {
            onWarning(ViolationType.NO_FACE_DETECTED);
          }
        }
      }

      // Critical after extended period
      if (noFaceDuration >= criticalNoFaceThreshold) {
        if (onCritical) {
          onCritical(ViolationType.NO_FACE_DETECTED, Math.floor(noFaceDuration / 1000));
        }
      }
    } else {
      // Face detected - reset timer
      noFaceStartTimeRef.current = null;
    }

    // MULTIPLE FACES DETECTED
    if (faces && faces.length > 1) {
      const lastLog = lastViolationTimeRef.current[ViolationType.MULTIPLE_FACES] || 0;
      if (now - lastLog >= 5000) {
        logViolation(ViolationType.MULTIPLE_FACES, {
          faceCount: faces.length,
          timestamp: new Date().toISOString()
        });

        lastViolationTimeRef.current[ViolationType.MULTIPLE_FACES] = now;

        if (onWarning) {
          onWarning(ViolationType.MULTIPLE_FACES);
        }
      }
    }
  }, [
    enabled,
    isDetecting,
    faces,
    noFaceThreshold,
    criticalNoFaceThreshold,
    logViolation,
    ViolationType,
    onWarning,
    onCritical
  ]);

  /**
   * Start webcam monitoring
   */
  const startMonitoring = useCallback(async () => {
    if (isMonitoring) return;

    try {
      await startDetection();
      setIsMonitoring(true);

      // Set up periodic checks
      checkIntervalRef.current = setInterval(checkFaceStatus, interval);

      console.log('Webcam monitoring started');
    } catch (error) {
      console.error('Failed to start webcam monitoring:', error);
    }
  }, [isMonitoring, startDetection, checkFaceStatus, interval]);

  /**
   * Stop webcam monitoring
   */
  const stopMonitoring = useCallback(() => {
    if (!isMonitoring) return;

    stopDetection();
    setIsMonitoring(false);

    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }

    noFaceStartTimeRef.current = null;
    lastViolationTimeRef.current = {};

    console.log('Webcam monitoring stopped');
  }, [isMonitoring, stopDetection]);

  // Auto-start/stop based on enabled prop
  useEffect(() => {
    if (enabled && !isMonitoring) {
      startMonitoring();
    } else if (!enabled && isMonitoring) {
      stopMonitoring();
    }
  }, [enabled, isMonitoring, startMonitoring, stopMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (isMonitoring) {
        stopDetection();
      }
    };
  }, [isMonitoring, stopDetection]);

  return {
    isMonitoring,
    faces,
    validationStatus,
    startMonitoring,
    stopMonitoring
  };
}
