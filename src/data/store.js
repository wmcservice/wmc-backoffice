import { seedJobs, seedStaff, seedAllocations, seedParameters, seedHolidays } from './seed';

const KEYS = {
    jobs: 'wmc_jobs',
    staff: 'wmc_staff',
    allocations: 'wmc_allocations',
    parameters: 'wmc_parameters',
    holidays: 'wmc_holidays',
};

function load(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
    } catch (e) {
        console.warn(`Failed to load ${key}`, e);
    }
    return fallback;
}

function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// Initialize with seed data if empty
export function initStore() {
    if (!localStorage.getItem(KEYS.jobs)) save(KEYS.jobs, seedJobs);
    if (!localStorage.getItem(KEYS.staff)) save(KEYS.staff, seedStaff);
    if (!localStorage.getItem(KEYS.allocations)) save(KEYS.allocations, seedAllocations);
    if (!localStorage.getItem(KEYS.parameters)) save(KEYS.parameters, seedParameters);
    if (!localStorage.getItem(KEYS.holidays)) save(KEYS.holidays, seedHolidays);
}

// ─── Jobs ────────────────────────────────────────
export function getJobs() { return load(KEYS.jobs, []); }
export function getJob(id) { return getJobs().find(j => j.id === id); }
export function saveJob(job) {
    const jobs = getJobs();
    const idx = jobs.findIndex(j => j.id === job.id);
    job.updatedAt = new Date().toISOString();
    if (idx >= 0) jobs[idx] = job; else jobs.push(job);
    save(KEYS.jobs, jobs);
    return job;
}
export function deleteJob(id) {
    save(KEYS.jobs, getJobs().filter(j => j.id !== id));
    // Also remove related allocations
    save(KEYS.allocations, getAllocations().filter(a => a.jobId !== id));
}

export function importJobs(newJobs) {
    save(KEYS.jobs, newJobs);
    return newJobs;
}

// ─── Staff ───────────────────────────────────────
export function getStaff() { return load(KEYS.staff, []); }
export function getStaffMember(id) { return getStaff().find(s => s.id === id); }
export function saveStaffMember(staff) {
    const all = getStaff();
    const idx = all.findIndex(s => s.id === staff.id);
    if (idx >= 0) all[idx] = staff; else all.push(staff);
    save(KEYS.staff, all);
    return staff;
}
export function deleteStaffMember(id) {
    save(KEYS.staff, getStaff().filter(s => s.id !== id));
}

export function syncStaffWithSeed() {
    save(KEYS.staff, seedStaff);
    return seedStaff;
}

export function importStaff(newStaffList) {
    save(KEYS.staff, newStaffList);
    return newStaffList;
}

// ─── Allocations ─────────────────────────────────
export function getAllocations() { return load(KEYS.allocations, []); }
export function getAllocation(id) { return getAllocations().find(a => a.id === id); }
export function saveAllocation(alloc) {
    const all = getAllocations();
    const idx = all.findIndex(a => a.id === alloc.id);
    if (idx >= 0) all[idx] = alloc; else all.push(alloc);
    save(KEYS.allocations, all);
    return alloc;
}
export function deleteAllocation(id) {
    save(KEYS.allocations, getAllocations().filter(a => a.id !== id));
}
export function getAllocationsByJob(jobId) {
    return getAllocations().filter(a => a.jobId === jobId);
}
export function getAllocationsByStaff(staffId) {
    return getAllocations().filter(a => a.staffId === staffId);
}
export function getAllocationsByDate(date) {
    return getAllocations().filter(a => a.date === date);
}

// ─── Parameters ──────────────────────────────────
export function getParameters() { return load(KEYS.parameters, seedParameters); }
export function saveParameters(params) { save(KEYS.parameters, params); return params; }

// ─── Holidays ────────────────────────────────────
export function getHolidays() { return load(KEYS.holidays, []); }
export function saveHoliday(holiday) {
    const all = getHolidays();
    const idx = all.findIndex(h => h.id === holiday.id);
    if (idx >= 0) all[idx] = holiday; else all.push(holiday);
    save(KEYS.holidays, all);
    return holiday;
}
export function deleteHoliday(id) {
    save(KEYS.holidays, getHolidays().filter(h => h.id !== id));
}
export function isHoliday(dateStr) {
    return getHolidays().some(h => h.date === dateStr);
}

// ─── Data Export/Import ──────────────────────────
export function exportAllData() {
    return {
        jobs: getJobs(),
        staff: getStaff(),
        allocations: getAllocations(),
        parameters: getParameters(),
        holidays: getHolidays(),
        exportedAt: new Date().toISOString(),
    };
}

export function importAllData(data) {
    if (data.jobs) save(KEYS.jobs, data.jobs);
    if (data.staff) save(KEYS.staff, data.staff);
    if (data.allocations) save(KEYS.allocations, data.allocations);
    if (data.parameters) save(KEYS.parameters, data.parameters);
    if (data.holidays) save(KEYS.holidays, data.holidays);
}

export function resetAllData() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    initStore();
}
