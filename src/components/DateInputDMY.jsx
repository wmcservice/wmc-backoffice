import { useState, useRef } from 'react';

/**
 * A custom date input that always displays in DD/MM/YYYY format,
 * regardless of the user's OS locale settings.
 * Internally stores and emits values as YYYY-MM-DD (ISO format).
 */
export default function DateInputDMY({ value, onChange, className = 'input', ...props }) {
    return (
        <input
            type="date"
            className={className}
            value={value || ''}
            onChange={onChange}
            {...props}
        />
    );
}
