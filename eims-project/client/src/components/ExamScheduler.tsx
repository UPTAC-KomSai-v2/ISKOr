import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Settings,
  AlertCircle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';

interface ExamSchedulerProps {
  /** Current exam settings */
  initialValues?: {
    startDate?: Date | string;
    endDate?: Date | string;
    timeLimitMinutes?: number;
    autoSubmitOnTimeExpire?: boolean;
    showTimerWarning?: boolean;
    warningThresholdMinutes?: number;
    lateSubmissionAllowed?: boolean;
    lateSubmissionPenalty?: number;
    maxAttempts?: number;
  };
  /** Callback when settings change */
  onChange: (settings: ExamScheduleSettings) => void;
  /** Whether the form is disabled */
  disabled?: boolean;
  /** Show advanced options by default */
  showAdvancedByDefault?: boolean;
  /** Custom class name */
  className?: string;
}

export interface ExamScheduleSettings {
  startDate: string | null;
  endDate: string | null;
  timeLimitMinutes: number | null;
  autoSubmitOnTimeExpire: boolean;
  showTimerWarning: boolean;
  warningThresholdMinutes: number;
  lateSubmissionAllowed: boolean;
  lateSubmissionPenalty: number;
  maxAttempts: number;
}

const ExamScheduler = ({
  initialValues = {},
  onChange,
  disabled = false,
  showAdvancedByDefault = false,
  className = '',
}: ExamSchedulerProps) => {
  const [showAdvanced, setShowAdvanced] = useState(showAdvancedByDefault);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [settings, setSettings] = useState<ExamScheduleSettings>({
    startDate: initialValues.startDate
      ? formatDateTimeLocal(initialValues.startDate)
      : null,
    endDate: initialValues.endDate
      ? formatDateTimeLocal(initialValues.endDate)
      : null,
    timeLimitMinutes: initialValues.timeLimitMinutes || null,
    autoSubmitOnTimeExpire: initialValues.autoSubmitOnTimeExpire ?? true,
    showTimerWarning: initialValues.showTimerWarning ?? true,
    warningThresholdMinutes: initialValues.warningThresholdMinutes || 5,
    lateSubmissionAllowed: initialValues.lateSubmissionAllowed ?? false,
    lateSubmissionPenalty: initialValues.lateSubmissionPenalty || 0,
    maxAttempts: initialValues.maxAttempts || 1,
  });

  // Format date for datetime-local input
  function formatDateTimeLocal(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - offset * 60 * 1000);
    return localDate.toISOString().slice(0, 16);
  }

  // Validate settings
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (settings.startDate && settings.endDate) {
      const start = new Date(settings.startDate);
      const end = new Date(settings.endDate);
      
      if (end <= start) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    if (settings.timeLimitMinutes !== null && settings.timeLimitMinutes <= 0) {
      newErrors.timeLimitMinutes = 'Time limit must be positive';
    }

    if (settings.warningThresholdMinutes <= 0) {
      newErrors.warningThresholdMinutes = 'Warning threshold must be positive';
    }

    if (settings.timeLimitMinutes && settings.warningThresholdMinutes >= settings.timeLimitMinutes) {
      newErrors.warningThresholdMinutes = 'Warning should be less than time limit';
    }

    if (settings.lateSubmissionPenalty < 0 || settings.lateSubmissionPenalty > 100) {
      newErrors.lateSubmissionPenalty = 'Penalty must be 0-100%';
    }

    if (settings.maxAttempts < 1) {
      newErrors.maxAttempts = 'At least 1 attempt required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle changes
  const handleChange = (field: keyof ExamScheduleSettings, value: any) => {
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    
    // Validate and notify parent
    setTimeout(() => {
      if (validate()) {
        onChange(newSettings);
      }
    }, 0);
  };

  // Notify parent on initial render and changes
  useEffect(() => {
    if (validate()) {
      onChange(settings);
    }
  }, []);

  // Quick time presets
  const timePresets = [
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '45 min', value: 45 },
    { label: '1 hour', value: 60 },
    { label: '1.5 hours', value: 90 },
    { label: '2 hours', value: 120 },
    { label: '3 hours', value: 180 },
    { label: 'None', value: null },
  ];

  // Quick date presets
  const setDatePreset = (preset: 'today' | 'tomorrow' | 'nextWeek') => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (preset) {
      case 'today':
        start = new Date(now.setHours(now.getHours() + 1, 0, 0, 0));
        end = new Date(now);
        end.setHours(23, 59, 0, 0);
        break;
      case 'tomorrow':
        start = new Date(now);
        start.setDate(start.getDate() + 1);
        start.setHours(9, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 0, 0);
        break;
      case 'nextWeek':
        start = new Date(now);
        start.setDate(start.getDate() + 7);
        start.setHours(9, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 0, 0);
        break;
    }

    handleChange('startDate', formatDateTimeLocal(start));
    setTimeout(() => {
      handleChange('endDate', formatDateTimeLocal(end));
    }, 0);
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Exam Schedule & Settings</h3>
            <p className="text-sm text-gray-500">Configure when and how students can take this exam</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Quick Date Presets */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quick Schedule
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDatePreset('today')}
              disabled={disabled}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('tomorrow')}
              disabled={disabled}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('nextWeek')}
              disabled={disabled}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Next Week
            </button>
          </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date & Time
            </label>
            <input
              type="datetime-local"
              value={settings.startDate || ''}
              onChange={(e) => handleChange('startDate', e.target.value || null)}
              disabled={disabled}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-50 ${
                errors.startDate ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.startDate && (
              <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Exam becomes available at this time
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date & Time
            </label>
            <input
              type="datetime-local"
              value={settings.endDate || ''}
              onChange={(e) => handleChange('endDate', e.target.value || null)}
              disabled={disabled}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-50 ${
                errors.endDate ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.endDate && (
              <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Exam closes at this time
            </p>
          </div>
        </div>

        {/* Time Limit */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Time Limit per Attempt
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {timePresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleChange('timeLimitMinutes', preset.value)}
                disabled={disabled}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50 ${
                  settings.timeLimitMinutes === preset.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <input
                type="number"
                value={settings.timeLimitMinutes || ''}
                onChange={(e) => handleChange('timeLimitMinutes', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Custom minutes"
                disabled={disabled}
                className={`w-full px-3 py-2 pr-16 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 ${
                  errors.timeLimitMinutes ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                minutes
              </span>
            </div>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          {errors.timeLimitMinutes && (
            <p className="mt-1 text-sm text-red-600">{errors.timeLimitMinutes}</p>
          )}
        </div>

        {/* Attempts */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Maximum Attempts
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="1"
              max="10"
              value={settings.maxAttempts}
              onChange={(e) => handleChange('maxAttempts', parseInt(e.target.value) || 1)}
              disabled={disabled}
              className={`w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 ${
                errors.maxAttempts ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            <RefreshCw className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-500">
              {settings.maxAttempts === 1 ? 'Single attempt only' : `Up to ${settings.maxAttempts} attempts`}
            </span>
          </div>
          {errors.maxAttempts && (
            <p className="mt-1 text-sm text-red-600">{errors.maxAttempts}</p>
          )}
        </div>

        {/* Advanced Settings Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Advanced Settings
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            {/* Auto Submit */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoSubmitOnTimeExpire}
                onChange={(e) => handleChange('autoSubmitOnTimeExpire', e.target.checked)}
                disabled={disabled}
                className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
              />
              <div>
                <p className="font-medium text-gray-900">Auto-submit on time expire</p>
                <p className="text-sm text-gray-500">
                  Automatically submit the exam when time runs out
                </p>
              </div>
            </label>

            {/* Timer Warning */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showTimerWarning}
                onChange={(e) => handleChange('showTimerWarning', e.target.checked)}
                disabled={disabled}
                className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Show timer warning</p>
                <p className="text-sm text-gray-500 mb-2">
                  Alert students when time is running low
                </p>
                {settings.showTimerWarning && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Warn at</span>
                    <input
                      type="number"
                      min="1"
                      value={settings.warningThresholdMinutes}
                      onChange={(e) => handleChange('warningThresholdMinutes', parseInt(e.target.value) || 5)}
                      disabled={disabled}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">minutes remaining</span>
                  </div>
                )}
              </div>
            </label>

            {/* Late Submission */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.lateSubmissionAllowed}
                onChange={(e) => handleChange('lateSubmissionAllowed', e.target.checked)}
                disabled={disabled}
                className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900">Allow late submission</p>
                <p className="text-sm text-gray-500 mb-2">
                  Accept submissions after the end date
                </p>
                {settings.lateSubmissionAllowed && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Penalty:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.lateSubmissionPenalty}
                      onChange={(e) => handleChange('lateSubmissionPenalty', parseInt(e.target.value) || 0)}
                      disabled={disabled}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">% deduction</span>
                  </div>
                )}
              </div>
            </label>
          </div>
        )}

        {/* Summary */}
        {(settings.startDate || settings.endDate || settings.timeLimitMinutes) && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Schedule Summary</p>
                <ul className="space-y-1">
                  {settings.startDate && (
                    <li>Opens: {new Date(settings.startDate).toLocaleString()}</li>
                  )}
                  {settings.endDate && (
                    <li>Closes: {new Date(settings.endDate).toLocaleString()}</li>
                  )}
                  {settings.timeLimitMinutes && (
                    <li>Time limit: {settings.timeLimitMinutes} minutes per attempt</li>
                  )}
                  <li>Attempts allowed: {settings.maxAttempts}</li>
                  {settings.lateSubmissionAllowed && (
                    <li>Late submissions: {settings.lateSubmissionPenalty}% penalty</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamScheduler;
