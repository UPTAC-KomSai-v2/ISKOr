import { useState, useEffect, useCallback } from 'react';
import { Clock, AlertTriangle, Bell } from 'lucide-react';

interface ExamTimerProps {
  /** Time expiry timestamp */
  timeExpiry: Date | string | null;
  /** Total time limit in minutes (for display purposes) */
  timeLimitMinutes?: number;
  /** Warning threshold in minutes */
  warningThresholdMinutes?: number;
  /** Show timer warning setting */
  showTimerWarning?: boolean;
  /** Callback when time expires */
  onTimeExpire?: () => void;
  /** Callback for time updates (useful for auto-save) */
  onTimeUpdate?: (remainingSeconds: number) => void;
  /** Whether the timer is paused */
  isPaused?: boolean;
  /** Custom styling */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Position variant */
  position?: 'inline' | 'fixed';
}

const ExamTimer = ({
  timeExpiry,
  timeLimitMinutes = 60,
  warningThresholdMinutes = 5,
  showTimerWarning = true,
  onTimeExpire,
  onTimeUpdate,
  isPaused = false,
  className = '',
  size = 'md',
  position = 'inline',
}: ExamTimerProps) => {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [hasWarned, setHasWarned] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

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

    const updateTimer = () => {
      const remaining = calculateRemainingTime();
      if (remaining === null) return;

      setRemainingSeconds(remaining);
      
      // Notify parent of time updates
      if (onTimeUpdate) {
        onTimeUpdate(remaining);
      }

      // Handle expiration
      if (remaining <= 0 && !isExpired) {
        setIsExpired(true);
        if (onTimeExpire) {
          onTimeExpire();
        }
      }

      // Handle warning threshold
      if (
        showTimerWarning &&
        !hasWarned &&
        remaining <= warningThresholdMinutes * 60 &&
        remaining > 0
      ) {
        setHasWarned(true);
        setIsFlashing(true);
        
        // Play warning sound (optional)
        try {
          const audio = new Audio('/sounds/timer-warning.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {}); // Ignore if audio fails
        } catch (e) {
          // Audio not available
        }

        // Show browser notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Exam Time Warning', {
            body: `Only ${warningThresholdMinutes} minutes remaining!`,
            icon: '/favicon.ico',
          });
        }

        // Stop flashing after 5 seconds
        setTimeout(() => setIsFlashing(false), 5000);
      }

      // Critical time - last minute flashing
      if (remaining <= 60 && remaining > 0) {
        setIsFlashing(true);
      }
    };

    // Initial update
    updateTimer();

    // Update every second if not paused
    const interval = setInterval(() => {
      if (!isPaused) {
        updateTimer();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    timeExpiry,
    calculateRemainingTime,
    isPaused,
    hasWarned,
    isExpired,
    showTimerWarning,
    warningThresholdMinutes,
    onTimeExpire,
    onTimeUpdate,
  ]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

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
  const getTimeStatus = () => {
    if (remainingSeconds === null) return 'loading';
    if (remainingSeconds <= 0) return 'expired';
    if (remainingSeconds <= 60) return 'critical';
    if (remainingSeconds <= warningThresholdMinutes * 60) return 'warning';
    return 'normal';
  };

  const status = getTimeStatus();

  // Size classes
  const sizeClasses = {
    sm: {
      container: 'px-3 py-1.5',
      text: 'text-sm font-medium',
      icon: 'w-4 h-4',
    },
    md: {
      container: 'px-4 py-2',
      text: 'text-base font-semibold',
      icon: 'w-5 h-5',
    },
    lg: {
      container: 'px-6 py-3',
      text: 'text-lg font-bold',
      icon: 'w-6 h-6',
    },
  };

  // Status classes
  const statusClasses = {
    normal: 'bg-gray-100 text-gray-700 border-gray-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-300',
    critical: 'bg-red-100 text-red-700 border-red-300',
    expired: 'bg-red-600 text-white border-red-700',
    loading: 'bg-gray-100 text-gray-400 border-gray-200',
  };

  // Position classes
  const positionClasses = {
    inline: '',
    fixed: 'fixed top-4 right-4 z-50 shadow-lg',
  };

  // Calculate progress for visual indicator
  const totalSeconds = timeLimitMinutes * 60;
  const progressPercent = remainingSeconds !== null
    ? Math.min(100, (remainingSeconds / totalSeconds) * 100)
    : 100;

  // Render nothing if no expiry
  if (!timeExpiry) return null;

  return (
    <div
      className={`
        ${sizeClasses[size].container}
        ${statusClasses[status]}
        ${positionClasses[position]}
        ${isFlashing ? 'animate-pulse' : ''}
        ${className}
        inline-flex items-center gap-2 rounded-lg border transition-all duration-300
      `}
    >
      {/* Icon */}
      {status === 'warning' || status === 'critical' ? (
        <AlertTriangle className={`${sizeClasses[size].icon} ${status === 'critical' ? 'animate-bounce' : ''}`} />
      ) : (
        <Clock className={sizeClasses[size].icon} />
      )}

      {/* Time Display */}
      <span className={`${sizeClasses[size].text} font-mono tabular-nums`}>
        {formatTime(remainingSeconds)}
      </span>

      {/* Progress Bar (for md and lg sizes) */}
      {size !== 'sm' && (
        <div className="w-20 h-1.5 bg-gray-300 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              status === 'expired' ? 'bg-red-500' :
              status === 'critical' ? 'bg-red-500' :
              status === 'warning' ? 'bg-amber-500' :
              'bg-green-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Status Text */}
      {status === 'expired' && (
        <span className="text-xs font-medium ml-1">Time's Up!</span>
      )}
      {status === 'warning' && size !== 'sm' && (
        <span className="text-xs font-medium ml-1 hidden sm:inline">Low Time</span>
      )}

      {/* Pause Indicator */}
      {isPaused && (
        <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full ml-1">
          PAUSED
        </span>
      )}
    </div>
  );
};

// Compact version for exam navigation
export const ExamTimerCompact = ({
  timeExpiry,
  timeLimitMinutes,
  warningThresholdMinutes = 5,
}: {
  timeExpiry: Date | string | null;
  timeLimitMinutes?: number;
  warningThresholdMinutes?: number;
}) => {
  return (
    <ExamTimer
      timeExpiry={timeExpiry}
      timeLimitMinutes={timeLimitMinutes}
      warningThresholdMinutes={warningThresholdMinutes}
      size="sm"
    />
  );
};

// Floating version that stays visible while scrolling
export const ExamTimerFloating = ({
  timeExpiry,
  timeLimitMinutes,
  warningThresholdMinutes = 5,
  onTimeExpire,
}: {
  timeExpiry: Date | string | null;
  timeLimitMinutes?: number;
  warningThresholdMinutes?: number;
  onTimeExpire?: () => void;
}) => {
  return (
    <ExamTimer
      timeExpiry={timeExpiry}
      timeLimitMinutes={timeLimitMinutes}
      warningThresholdMinutes={warningThresholdMinutes}
      position="fixed"
      size="md"
      onTimeExpire={onTimeExpire}
    />
  );
};

export default ExamTimer;
