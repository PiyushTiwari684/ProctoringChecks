import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import apiClient from '../api/apiClient';
import { v4 as uuidv4 } from 'uuid';

const ProctorContext = createContext();

// Violation types
export const ViolationType = {
  TAB_SWITCH: 'TAB_SWITCH',
  RIGHT_CLICK: 'RIGHT_CLICK',
  KEYBOARD_SHORTCUT: 'KEYBOARD_SHORTCUT',
  DEVTOOLS_OPEN: 'DEVTOOLS_OPEN',
  NEW_WINDOW_ATTEMPT: 'NEW_WINDOW_ATTEMPT',
  FULLSCREEN_EXIT: 'FULLSCREEN_EXIT',
  NO_FACE_DETECTED: 'NO_FACE_DETECTED',
  MULTIPLE_FACES: 'MULTIPLE_FACES',
  IP_CHANGE: 'IP_CHANGE',
  LOCATION_CHANGE: 'LOCATION_CHANGE',
  COPY_PASTE: 'COPY_PASTE',
  PAGE_BLUR: 'PAGE_BLUR'
};

// Severity levels
export const ViolationSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

// Violation thresholds and auto-actions
export const VIOLATION_THRESHOLDS = {
  [ViolationType.TAB_SWITCH]: {
    warningThreshold: 1, // tab switches before warning threshold
    autoSubmitThreshold: 3,
    severity: ViolationSeverity.HIGH
  },
  [ViolationType.PAGE_BLUR]:{
    warningThreshold: 3, // 3 pe warning 
    autoSubmitThreshold: 5, // 5 pe submit
    severity: ViolationSeverity.HIGH  
  },
  [ViolationType.RIGHT_CLICK]: {
    warningThreshold: 3, 
    autoSubmitThreshold: 5,
    severity: ViolationSeverity.LOW
  },
  [ViolationType.KEYBOARD_SHORTCUT]: {
    warningThreshold: 3,
    autoSubmitThreshold: 5,
    severity: ViolationSeverity.MEDIUM
  },
  [ViolationType.DEVTOOLS_OPEN]: {
    warningThreshold: 1,
    autoSubmitThreshold: 2,
    severity: ViolationSeverity.CRITICAL
  },
  [ViolationType.NEW_WINDOW_ATTEMPT]: {
    warningThreshold: 1,
    autoSubmitThreshold: 3,
    severity: ViolationSeverity.HIGH
  },  
  [ViolationType.FULLSCREEN_EXIT]: {
    warningThreshold: 1,
    autoSubmitThreshold: 3,
    severity: ViolationSeverity.HIGH
  },
  [ViolationType.NO_FACE_DETECTED]: {
    warningThreshold:2,
    autoSubmitThreshold:7,
    severity: ViolationSeverity.HIGH
  },
  [ViolationType.MULTIPLE_FACES]: {
    warningThreshold: 1,
    autoSubmitThreshold: 3,
    severity: ViolationSeverity.HIGH
  },
  [ViolationType.IP_CHANGE]: {
    warningThreshold: 0,
    autoSubmitThreshold: 1,
    severity: ViolationSeverity.CRITICAL
  },
  [ViolationType.LOCATION_CHANGE]: {
    warningThreshold: 0,
    autoSubmitThreshold: 1,
    severity: ViolationSeverity.CRITICAL
  },
  [ViolationType.COPY_PASTE]: {
    warningThreshold: 3,
    autoSubmitThreshold: 8,
    severity: ViolationSeverity.MEDIUM
  }
};

export function ProctorProvider({ children }) {
  // Violations array
  const [violations, setViolations] = useState([]);

  // Violation counts by type
  const [violationCounts, setViolationCounts] = useState(
    Object.keys(ViolationType).reduce((acc, key) => {
      acc[ViolationType[key]] = 0;
      return acc;
    }, {})
  );

  // Proctoring state
  const [isProctoringActive, setIsProctoringActive] = useState(false);
  const [assessmentId, setAssessmentId] = useState(null);
  const [attemptId, setAttemptId] = useState(null);

  // Batch violation queue for sending to backend
  const [violationQueue, setViolationQueue] = useState([]);
  const batchIntervalRef = useRef(null);

  // Initial location and IP
  const [initialLocation, setInitialLocation] = useState(null);
  const [initialIP, setInitialIP] = useState(null);

  // Auto-submit callback
  const [onAutoSubmit, setOnAutoSubmit] = useState(null);

  /**
   * Start proctoring session
   */
  const startProctoring = useCallback((assessId, attemId, autoSubmitCallback) => {
    setIsProctoringActive(true);
    setAssessmentId(assessId);
    setAttemptId(attemId);
    setOnAutoSubmit(() => autoSubmitCallback);

    // Reset violations
    setViolations([]);
    setViolationCounts(
      Object.keys(ViolationType).reduce((acc, key) => {
        acc[ViolationType[key]] = 0;
        return acc;
      }, {})
    );
    setViolationQueue([]);
  }, []);

  /**
   * Stop proctoring session
   */
  const stopProctoring = useCallback(() => {
    setIsProctoringActive(false);

    // Send any remaining violations
    if (violationQueue.length > 0) {
      sendViolationsBatch(violationQueue);
    }

    // Clear batch interval
    if (batchIntervalRef.current) {
      clearInterval(batchIntervalRef.current);
      batchIntervalRef.current = null;
    }
  }, [violationQueue]);

  /**
   * Log a violation
   */
  const logViolation = useCallback((type, details = {}, customSeverity = null) => {
    if (!isProctoringActive) {
      console.warn('[Proctoring] Not active, violation not logged:', type);
      return;
    }

    const config = VIOLATION_THRESHOLDS[type];
    if (!config) {
      console.error('[Proctoring] Unknown violation type:', type);
      return;
    }

    const severity = customSeverity || config.severity;
    const timestamp = new Date().toISOString();
    const newCount = violationCounts[type] + 1;

    // Create violation record
    const violation = {
      id: uuidv4(),
      attemptId,
      assessmentId,
      type,
      timestamp,
      details,
      severity,
      count: newCount
    };

    // Console log with styling
    console.log(
      `%c[Proctoring Violation] ${type}`,
      `color: ${severity === 'CRITICAL' ? '#dc2626' : severity === 'HIGH' ? '#ea580c' : severity === 'MEDIUM' ? '#d97706' : '#65a30d'}; font-weight: bold;`,
      `\nCount: ${newCount}/${config.autoSubmitThreshold}`,
      `\nSeverity: ${severity}`,
      `\nDetails:`, details,
      `\nTimestamp: ${timestamp}`
    );

    // Update state
    setViolations(prev => [...prev, violation]);
    setViolationCounts(prev => ({
      ...prev,
      [type]: prev[type] + 1
    }));

    // Add to queue
    setViolationQueue(prev => [...prev, violation]);

    // Check if should auto-submit
    if (newCount >= config.autoSubmitThreshold) {
      console.warn(
        `%c[Proctoring] AUTO-SUBMIT TRIGGERED`,
        'color: #dc2626; font-weight: bold; font-size: 14px;',
        `\nViolation: ${type}`,
        `\nCount: ${newCount}/${config.autoSubmitThreshold}`
      );
      if (onAutoSubmit) {
        onAutoSubmit(type, newCount);
      }
    }

    // Send immediately if critical
    if (severity === ViolationSeverity.CRITICAL) {
      sendViolationImmediate(violation);
    }
  }, [isProctoringActive, attemptId, assessmentId, violationCounts, onAutoSubmit]);

  /**
   * Send violation immediately (for critical violations)
   */
  const sendViolationImmediate = useCallback(async (violation) => {
    try {
      // TODO: Replace with actual backend endpoint
      await apiClient.post(
        `/assessments/${violation.assessmentId}/attempts/${violation.attemptId}/violations`,
        {
          type: violation.type,
          timestamp: violation.timestamp,
          details: violation.details,
          severity: violation.severity,
          count: violation.count
        }
      );
      console.log('Critical violation sent immediately:', violation.id);
    } catch (error) {
      console.error('Failed to send critical violation:', error);
      // Store in localStorage as backup
      storeViolationLocally(violation);
    }
  }, []);

  /**
   * Send violations in batch
   */
  const sendViolationsBatch = useCallback(async (batch) => {
    if (batch.length === 0) return;

    try {
      // TODO: Replace with actual backend endpoint
      await apiClient.post(
        `/assessments/${assessmentId}/attempts/${attemptId}/violations/batch`,
        {
          violations: batch.map(v => ({
            type: v.type,
            timestamp: v.timestamp,
            details: v.details,
            severity: v.severity,
            count: v.count
          }))
        }
      );
      console.log(`Batch of ${batch.length} violations sent successfully`);

      // Clear queue
      setViolationQueue([]);
    } catch (error) {
      console.error('Failed to send violation batch:', error);
      // Store in localStorage as backup
      batch.forEach(v => storeViolationLocally(v));
    }
  }, [assessmentId, attemptId]);

  /**
   * Store violation in localStorage as backup
   */
  const storeViolationLocally = (violation) => {
    try {
      const key = `violations_${attemptId}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push(violation);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (error) {
      console.error('Failed to store violation locally:', error);
    }
  };

  /**
   * Get violation summary
   */
  const getViolationSummary = useCallback(() => {
    return {
      total: violations.length,
      counts: violationCounts,
      byType: Object.keys(ViolationType).map(key => ({
        type: ViolationType[key],
        count: violationCounts[ViolationType[key]],
        threshold: VIOLATION_THRESHOLDS[ViolationType[key]].autoSubmitThreshold
      })),
      critical: violations.filter(v => v.severity === ViolationSeverity.CRITICAL).length,
      high: violations.filter(v => v.severity === ViolationSeverity.HIGH).length,
      medium: violations.filter(v => v.severity === ViolationSeverity.MEDIUM).length,
      low: violations.filter(v => v.severity === ViolationSeverity.LOW).length
    };
  }, [violations, violationCounts]);

  /**
   * Check if should show warning for a violation type
   */
  const shouldShowWarning = useCallback((type) => {
    const config = VIOLATION_THRESHOLDS[type];
    const count = violationCounts[type];
    return count >= config.warningThreshold && count < config.autoSubmitThreshold;
  }, [violationCounts]);

  /**
   * Check if should auto-submit for any violation type
   */
  const shouldAutoSubmitForViolations = useCallback(() => {
    return Object.keys(ViolationType).some(key => {
      const type = ViolationType[key];
      const config = VIOLATION_THRESHOLDS[type];
      return violationCounts[type] >= config.autoSubmitThreshold;
    });
  }, [violationCounts]);

  // Set up batch sending interval (every 30 seconds)
  useEffect(() => {
    if (isProctoringActive) {
      batchIntervalRef.current = setInterval(() => {
        if (violationQueue.length > 0) {
          sendViolationsBatch(violationQueue);
        }
      }, 30000); // 30 seconds

      return () => {
        if (batchIntervalRef.current) {
          clearInterval(batchIntervalRef.current);
        }
      };
    }
  }, [isProctoringActive, violationQueue, sendViolationsBatch]);

  const value = {
    // State
    violations,
    violationCounts,
    isProctoringActive,
    assessmentId,
    attemptId,
    initialLocation,
    initialIP,

    // Setters
    setInitialLocation,
    setInitialIP,

    // Methods
    startProctoring,
    stopProctoring,
    logViolation,
    getViolationSummary,
    shouldShowWarning,
    shouldAutoSubmitForViolations,

    // Constants
    ViolationType,
    ViolationSeverity,
    VIOLATION_THRESHOLDS
  };

  return (
    <ProctorContext.Provider value={value}>
      {children}
    </ProctorContext.Provider>
  );
}

export function useProctorContext(){
  const context = useContext(ProctorContext);
  if (!context) {
    throw new Error('useProctorContext must be used within ProctorProvider');
  }
  return context;
}
