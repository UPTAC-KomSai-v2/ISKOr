import { useState, useEffect, useCallback, useRef } from 'react';

interface UseExamTimerOptions {
  /** Time expiry timestamp */
  timeExpiry: Date | string | null;
  /** Warning threshold in minutes */
  warningThresholdMinutes?: number;
  /** Callback when time expires */
  onTimeExpire?: () => void;
  /** Callback when warning threshold is reached */
  onWarning?: () => void;
  /** Auto-save callback (called every saveInterval seconds) */
  onAutoSave?: () => void;
  /** Auto-save interval in seconds */
  autoSaveInterval?: number;
  /** Whether the timer is paused */
  isPaused?: boolean;
}

interface UseExamTimerReturn {
  /** Remaining time in seconds */
  remainingSeconds: number | null;
  /** Formatted time string (HH:MM:SS or MM:SS) */
  formattedTime: string;
  /** Whether time has expired */
  isExpired: boolean;
  /** Whether in warning zone */
  isWarning: boolean;
  /** Whether in critical zone (last minute) */
  isCritical: boolean;
  /** Progress percentage (0-100) */
  progressPercent: number;
  /** Time status: 'normal' | 'warning' | 'critical' | 'expired' */
  status: 'normal' | 'warning' | 'critical' | 'expired';
  /** Pause the timer */
  pause: () => void;
  /** Resume the timer */
  resume: () => void;
  /** Get remaining time in specific format */
  getTimeInFormat: (format: 'seconds' | 'minutes' | 'hours') => number;
}

const useExamTimer = ({
  timeExpiry,
  warningThresholdMinutes = 5,
  onTimeExpire,
  onWarning,
  onAutoSave,
  autoSaveInterval = 30,
  isPaused: initialPaused = false,
}: UseExamTimerOptions): UseExamTimerReturn => {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(initialPaused);
  const [hasWarned, setHasWarned] = useState(false);
  const [hasExpired, setHasExpired] = useState(false);
  
  const autoSaveCounterRef = useRef(0);
  const initialTimeRef = useRef<number | null>(null);

  // Calculate remaining time
  const calculateRemainingTime = useCallback(() => {
    if (!timeExpiry) return null;
    
    const expiry = typeof timeExpiry === 'string' ? new Date(timeExpiry) : timeExpiry;
    const now = new Date();
    const remaining = Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / 1000));
    
    return remaining;
  }, [timeExpiry]);

  // Initialize and update timer
  useEffect(() => {
    if (!timeExpiry) return;

    // Set initial time
    const initial = calculateRemainingTime();
    if (initial !== null && initialTimeRef.current === null) {
      initialTimeRef.current = initial;
    }
    setRemainingSeconds(initial);

    const updateTimer = () => {
      if (isPaused) return;
      
      const remaining = calculateRemainingTime();
      if (remaining === null) return;

      setRemainingSeconds(remaining);

      // Handle expiration
      if (remaining <= 0 && !hasExpired) {
        setHasExpired(true);
        if (onTimeExpire) {
          onTimeExpire();
        }
      }

      // Handle warning threshold
      if (
        !hasWarned &&
        remaining <= warningThresholdMinutes * 60 &&
        remaining > 0
      ) {
        setHasWarned(true);
        if (onWarning) {
          onWarning();
        }
      }

      // Handle auto-save
      if (onAutoSave && autoSaveInterval > 0) {
        autoSaveCounterRef.current += 1;
        if (autoSaveCounterRef.current >= autoSaveInterval) {
          autoSaveCounterRef.current = 0;
          onAutoSave();
        }
      }
    };

    // Initial update
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [
    timeExpiry,
    calculateRemainingTime,
    isPaused,
    hasWarned,
    hasExpired,
    warningThresholdMinutes,
    onTimeExpire,
    onWarning,
    onAutoSave,
    autoSaveInterval,
  ]);

  // Format time display
  const formatTime = (seconds: number | null): string => {
    if (seconds === null) return '--:--:--';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get time status
  const getStatus = (): 'normal' | 'warning' | 'critical' | 'expired' => {
    if (remainingSeconds === null) return 'normal';
    if (remainingSeconds <= 0) return 'expired';
    if (remainingSeconds <= 60) return 'critical';
    if (remainingSeconds <= warningThresholdMinutes * 60) return 'warning';
    return 'normal';
  };

  // Calculate progress percentage
  const getProgressPercent = (): number => {
    if (remainingSeconds === null || initialTimeRef.current === null) return 100;
    return Math.min(100, (remainingSeconds / initialTimeRef.current) * 100);
  };

  // Get time in specific format
  const getTimeInFormat = (format: 'seconds' | 'minutes' | 'hours'): number => {
    if (remainingSeconds === null) return 0;
    switch (format) {
      case 'seconds':
        return remainingSeconds;
      case 'minutes':
        return Math.floor(remainingSeconds / 60);
      case 'hours':
        return Math.floor(remainingSeconds / 3600);
      default:
        return remainingSeconds;
    }
  };

  const status = getStatus();

  return {
    remainingSeconds,
    formattedTime: formatTime(remainingSeconds),
    isExpired: status === 'expired',
    isWarning: status === 'warning' || status === 'critical',
    isCritical: status === 'critical',
    progressPercent: getProgressPercent(),
    status,
    pause: () => setIsPaused(true),
    resume: () => setIsPaused(false),
    getTimeInFormat,
  };
};

export default useExamTimer;
