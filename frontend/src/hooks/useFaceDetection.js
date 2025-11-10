import { useState, useEffect, useRef, useCallback } from 'react';
import blazeFaceService from '../utils/blazeFaceService';
import { getValidationStatus } from '../utils/validationHelpers';

/**
 * useFaceDetection Hook
 *
 * Real-time face detection using BlazeFace
 *
 * @param {Object} videoRef - React ref to video element
 * @param {Object} options - Configuration options
 * @param {number} options.interval - Detection interval in ms (default: 100)
 * @param {boolean} options.enabled - Enable/disable detection (default: true)
 * @returns {Object} Detection state and controls
 */
export function useFaceDetection(videoRef, options = {}) {
  const { interval = 100, enabled = true } = options;

  const [faces, setFaces] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [validationStatus, setValidationStatus] = useState(null);
  const [error, setError] = useState(null);

  const detectionIntervalRef = useRef(null);
  const isProcessingRef = useRef(false);

  /**
   * Detect faces in current video frame
   */
  const detectFaces = useCallback(async () => {
    if (!videoRef.current || !enabled || isProcessingRef.current) {
      return;
    }

    try {
      isProcessingRef.current = true;

      // Get video element (handle both direct video and webcam component ref)
      const video = videoRef.current.video || videoRef.current;

      // Check if video is ready
      if (!video || video.readyState !== 4) {
        return;
      }

      // Run detection
      const detectedFaces = await blazeFaceService.detectFaces(video);
      setFaces(detectedFaces);

      // Validate faces
      const status = getValidationStatus(
        detectedFaces,
        video.videoWidth,
        video.videoHeight
      );
      setValidationStatus(status);

      setError(null);
    } catch (err) {
      console.error('[useFaceDetection] Detection error:', err);
      setError(err.message);
    } finally {
      isProcessingRef.current = false;
    }
  }, [videoRef, enabled]);

  /**
   * Start detection loop
   */
  const startDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      return; // Already running
    }

    console.log('[useFaceDetection] Starting detection loop');
    setIsDetecting(true);

    // Run detection immediately
    detectFaces();

    // Then run at interval
    detectionIntervalRef.current = setInterval(detectFaces, interval);
  }, [detectFaces, interval]);

  /**
   * Stop detection loop
   */
  const stopDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      console.log('[useFaceDetection] Stopping detection loop');
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
      setIsDetecting(false);
    }
  }, []);

  /**
   * Auto-start/stop detection based on enabled flag
   */
  useEffect(() => {
    if (enabled) {
      startDetection();
    } else {
      stopDetection();
    }

    return () => {
      stopDetection();
    };
  }, [enabled, startDetection, stopDetection]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  return {
    faces,
    isDetecting,
    validationStatus,
    error,
    startDetection,
    stopDetection
  };
}
