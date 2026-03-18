import { getParameters, isHoliday } from '../data/store';

/**
 * Parse a time string "HH:mm" into minutes since midnight.
 */
function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Calculate work hours and overtime breakdown for a given day.
 *
 * @param {string} checkIn - "HH:mm"
 * @param {string} checkOut - "HH:mm"
 * @param {string} dateStr - "YYYY-MM-DD"
 * @returns {{ totalMinutes, workMinutes, lunchDeducted, dinnerDeducted, regularHours, ot15, ot20, ot30, isHolidayDay }}
 */
export function calculateOvertime(checkIn, checkOut, dateStr) {
    const params = getParameters();
    const holiday = isHoliday(dateStr);

    const inMin = timeToMinutes(checkIn);
    const outMin = timeToMinutes(checkOut);
    const workStart = timeToMinutes(params.workStartTime);
    const workEnd = timeToMinutes(params.workEndTime);
    const lunchStart = timeToMinutes(params.lunchBreakStart);
    const dinnerThreshold = timeToMinutes(params.dinnerBreakThreshold);

    let totalMinutes = outMin - inMin;
    if (totalMinutes < 0) totalMinutes = 0;

    // Lunch break deduction: auto-deduct if work crosses noon
    let lunchDeducted = false;
    if (inMin < lunchStart + params.lunchBreakDuration && outMin > lunchStart) {
        totalMinutes -= params.lunchBreakDuration;
        lunchDeducted = true;
    }

    // Dinner break deduction: auto-deduct if work exceeds dinner threshold
    let dinnerDeducted = false;
    if (outMin > dinnerThreshold) {
        totalMinutes -= params.dinnerBreakDuration;
        dinnerDeducted = true;
    }

    if (totalMinutes < 0) totalMinutes = 0;

    const standardMinutes = workEnd - workStart - (lunchDeducted ? params.lunchBreakDuration : 0);

    let regularHours = 0;
    let ot15 = 0;
    let ot20 = 0;
    let ot30 = 0;

    if (holiday) {
        // All hours on holiday are OT 3x
        ot30 = totalMinutes / 60;
    } else {
        regularHours = Math.min(totalMinutes, standardMinutes) / 60;
        const overtimeMinutes = Math.max(0, totalMinutes - standardMinutes);

        // OT 1.5x: up to otRate1MaxHours
        const ot15Max = (params.otRate1MaxHours || 0) * 60;
        const ot15Minutes = Math.min(overtimeMinutes, ot15Max);
        ot15 = ot15Minutes / 60;

        // OT 2x: beyond otRate1MaxHours
        const ot20Minutes = Math.max(0, overtimeMinutes - ot15Max);
        ot20 = ot20Minutes / 60;
    }

    return {
        totalMinutes,
        totalHours: totalMinutes / 60,
        workMinutes: totalMinutes,
        lunchDeducted,
        dinnerDeducted,
        regularHours: Math.round(regularHours * 100) / 100,
        ot15: Math.round(ot15 * 100) / 100,
        ot20: Math.round(ot20 * 100) / 100,
        ot30: Math.round(ot30 * 100) / 100,
        isHolidayDay: holiday,
    };
}

/**
 * Calculate pay for a single day based on OT breakdown.
 */
export function calculateDailyPay(otResult) {
    const params = getParameters();
    const hourlyRate = params.baseDailyRate / 8;

    return {
        regularPay: otResult.regularHours * hourlyRate,
        ot15Pay: otResult.ot15 * hourlyRate * (params.otRate1 || 0),
        ot20Pay: otResult.ot20 * hourlyRate * (params.otRate2 || 0),
        ot30Pay: otResult.ot30 * hourlyRate * (params.otRate3 || 0),
        totalPay:
            otResult.regularHours * hourlyRate +
            otResult.ot15 * hourlyRate * (params.otRate1 || 0) +
            otResult.ot20 * hourlyRate * (params.otRate2 || 0) +
            otResult.ot30 * hourlyRate * (params.otRate3 || 0),
    };
}
