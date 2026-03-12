import { useState, useRef } from 'react';

/**
 * A custom time input that always displays in 24-hour format (HH:mm),
 * regardless of the user's OS locale settings.
 */
export default function TimeInput24({ value, onChange, className = 'input', ...props }) {
    const [localValue, setLocalValue] = useState(value || '');
    const inputRef = useRef(null);

    const handleChange = (e) => {
        let v = e.target.value;
        // Allow only digits and colon
        v = v.replace(/[^\d:]/g, '');

        // Auto-insert colon
        if (v.length === 2 && !v.includes(':') && localValue.length < v.length) {
            v = v + ':';
        }

        // Limit to 5 chars (HH:mm)
        if (v.length > 5) v = v.slice(0, 5);

        setLocalValue(v);

        // Only fire onChange if we have a valid time
        if (/^\d{2}:\d{2}$/.test(v)) {
            const [h, m] = v.split(':').map(Number);
            if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
                onChange({ target: { value: v } });
            }
        }
    };

    const handleBlur = () => {
        // On blur, revert to the prop value if invalid
        if (!/^\d{2}:\d{2}$/.test(localValue)) {
            setLocalValue(value || '');
        }
    };

    // Keep in sync with prop
    if (value !== undefined && value !== localValue && document.activeElement !== inputRef.current) {
        // Only update if input is not focused
    }

    return (
        <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            className={className}
            value={document.activeElement === inputRef.current ? localValue : (value || '')}
            onChange={handleChange}
            onFocus={() => setLocalValue(value || '')}
            onBlur={handleBlur}
            placeholder="HH:mm"
            pattern="[0-2][0-9]:[0-5][0-9]"
            maxLength={5}
            {...props}
        />
    );
}
