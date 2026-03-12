import { useState, useRef } from 'react';

/**
 * A custom date input that always displays in DD/MM/YYYY format,
 * regardless of the user's OS locale settings.
 * Internally stores and emits values as YYYY-MM-DD (ISO format).
 */
export default function DateInputDMY({ value, onChange, className = 'input', ...props }) {
    const inputRef = useRef(null);
    const [focused, setFocused] = useState(false);
    const [localValue, setLocalValue] = useState('');

    // Convert ISO (YYYY-MM-DD) to DD/MM/YYYY for display
    const toDisplay = (iso) => {
        if (!iso) return '';
        const parts = iso.split('-');
        if (parts.length !== 3) return iso;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    // Convert DD/MM/YYYY to ISO (YYYY-MM-DD) for storage
    const toISO = (display) => {
        if (!display) return '';
        const parts = display.split('/');
        if (parts.length !== 3) return '';
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };

    const displayValue = focused ? localValue : toDisplay(value);

    const handleChange = (e) => {
        let v = e.target.value;
        // Allow only digits and slash
        v = v.replace(/[^\d/]/g, '');

        // Auto-insert slashes
        const digits = v.replace(/\//g, '');
        if (digits.length <= 2) {
            v = digits;
        } else if (digits.length <= 4) {
            v = digits.slice(0, 2) + '/' + digits.slice(2);
        } else {
            v = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
        }

        if (v.length > 10) v = v.slice(0, 10);
        setLocalValue(v);

        // Fire onChange if we have a valid date
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
            const iso = toISO(v);
            const [y, m, d] = iso.split('-').map(Number);
            if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
                onChange({ target: { value: iso } });
            }
        }
    };

    const handleFocus = () => {
        setFocused(true);
        setLocalValue(toDisplay(value));
    };

    const handleBlur = () => {
        setFocused(false);
        // If invalid, revert to prop value
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(localValue)) {
            setLocalValue(toDisplay(value));
        }
    };

    return (
        <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            className={className}
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="DD/MM/YYYY"
            maxLength={10}
            {...props}
        />
    );
}
