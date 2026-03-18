// Mock Supabase client for local development using localStorage
import {
    getJobs, getJob, saveJob, deleteJob,
    getStaff, getStaffMember, saveStaffMember, deleteStaffMember,
    getAllocations, getAllocation, saveAllocation, deleteAllocation,
    getProgressLogs, saveProgressLog, deleteProgressLog,
    getLogStaffAssignments, saveLogStaffAssignment,
    getSubTasks, saveSubTask, deleteSubTasksByJobId,
    getAttachments, saveAttachment,
    importAllData
} from './store';

class MockQueryBuilder {
    constructor(data, table) {
        this.data = data;
        this.table = table;
    }

    select(columns = '*') {
        // Transform camelCase from localStorage to snake_case for Supabase compatibility
        this.data = this.data.map(item => {
            const newItem = {};
            Object.keys(item).forEach(key => {
                const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                newItem[snakeKey] = item[key];
            });

            // Ensure nested relations exist as expected by Supabase queries
            if (this.table === 'jobs') {
                // Attach related progress_logs and their staff assignments
                const allLogs = getProgressLogs();
                const allLogAssignments = getLogStaffAssignments();
                const allSubTasks = getSubTasks();
                const allAttachments = getAttachments();
                const jobId = newItem.id;

                newItem.sub_tasks = allSubTasks
                    .filter(t => t.jobId === jobId || t.job_id === jobId)
                    .map(t => ({ id: t.id, title: t.title, is_completed: t.isCompleted || t.is_completed || false, job_id: jobId }));

                newItem.attachments = allAttachments
                    .filter(a => a.jobId === jobId || a.job_id === jobId)
                    .map(a => ({ id: a.id, name: a.name, url: a.url, type: a.type, job_id: jobId }));

                newItem.progress_logs = allLogs
                    .filter(l => l.jobId === jobId || l.job_id === jobId)
                    .map(l => {
                        const logAssignments = allLogAssignments
                            .filter(la => la.logId === l.id || la.log_id === l.id)
                            .map(la => ({ staff_id: la.staffId || la.staff_id }));
                        return {
                            id: l.id,
                            log_date: l.logDate || l.log_date,
                            text: l.text,
                            author: l.author,
                            job_id: jobId,
                            log_staff_assignments: logAssignments,
                            attachments: []
                        };
                    });
            }
            return newItem;
        });
        return this;
    }

    eq(col, val) {
        this.data = this.data.filter(item => {
            const itemVal = item[col] || item[col?.toLowerCase()] || item[this._toCamel(col)];
            return String(itemVal) === String(val);
        });
        return this;
    }

    neq(col, val) {
        this.data = this.data.filter(item => {
            const itemVal = item[col] || item[col?.toLowerCase()] || item[this._toCamel(col)];
            return String(itemVal) !== String(val);
        });
        return this;
    }

    order(col, { ascending = true } = {}) {
        this.data = [...this.data].sort((a, b) => {
            const valA = a[col] || a[this._toCamel(col)] || '';
            const valB = b[col] || b[this._toCamel(col)] || '';
            if (valA < valB) return ascending ? -1 : 1;
            if (valA > valB) return ascending ? 1 : -1;
            return 0;
        });
        return this;
    }

    limit(n) {
        this.data = this.data.slice(0, n);
        return this;
    }

    insert(rows) {
        console.log(`[Offline Dev] Insert into ${this.table}:`, rows);
        const dataArr = Array.isArray(rows) ? rows : [rows];
        const insertedData = [];

        dataArr.forEach(row => {
            const camelRow = this._toCamelObj(row);
            if (!camelRow.id) camelRow.id = Math.random().toString(36).substr(2, 9);
            let saved;
            if (this.table === 'jobs') saved = saveJob(camelRow);
            else if (this.table === 'staff') saved = saveStaffMember(camelRow);
            else if (this.table === 'allocations') saved = saveAllocation(camelRow);
            else if (this.table === 'progress_logs') saved = saveProgressLog(camelRow);
            else if (this.table === 'log_staff_assignments') saved = saveLogStaffAssignment(camelRow);
            else if (this.table === 'sub_tasks') saved = saveSubTask(camelRow);
            else if (this.table === 'attachments') saved = saveAttachment(camelRow);

            if (saved) {
                // Return snake_case for Supabase compatibility
                const snakeSaved = {};
                Object.keys(saved).forEach(key => {
                    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                    snakeSaved[snakeKey] = saved[key];
                });
                insertedData.push(snakeSaved);
            }
        });

        this.data = insertedData;
        return this; // Return this to allow .select() or other chaining
    }

    upsert(rows) {
        console.log(`[Offline Dev] Upsert into ${this.table}:`, rows);
        return this.insert(rows);
    }

    update(updates) {
        console.log(`[Offline Dev] Update ${this.table}:`, updates);
        const table = this.table;
        const toCamelObj = this._toCamelObj.bind(this);

        // Return a non-thenable wrapper so `await` doesn't prematurely resolve
        return {
            eq: (col, val) => {
                const camelUpdates = toCamelObj(updates);
                if (col === 'id') {
                    if (table === 'jobs') {
                        const existing = getJob(val);
                        if (existing) saveJob({ ...existing, ...camelUpdates });
                    } else if (table === 'staff') {
                        const existing = getStaffMember(val);
                        if (existing) saveStaffMember({ ...existing, ...camelUpdates });
                    } else if (table === 'allocations') {
                        const existing = getAllocation(val);
                        if (existing) saveAllocation({ ...existing, ...camelUpdates });
                    }
                }
                return Promise.resolve({ data: [camelUpdates], error: null });
            }
        };
    }

    delete() {
        console.log(`[Offline Dev] Delete from ${this.table}`);
        const table = this.table;
        let pendingFilters = [];

        const self = {
            eq: (col, val) => {
                pendingFilters.push({ col, val });
                // Execute delete
                if (table === 'jobs' && col === 'id') deleteJob(val);
                else if (table === 'staff' && col === 'id') deleteStaffMember(val);
                else if (table === 'allocations') {
                    if (col === 'id') deleteAllocation(val);
                    else if (col === 'job_id') {
                        const all = getAllocations().filter(a => a.jobId !== val);
                        importAllData({ allocations: all });
                    }
                }
                else if (table === 'progress_logs' && col === 'id') deleteProgressLog(val);
                else if (table === 'sub_tasks') {
                    if (col === 'id') {
                        const all = getSubTasks().filter(t => t.id !== val);
                        importAllData({ subTasks: all });
                    } else if (col === 'job_id') {
                        deleteSubTasksByJobId(val);
                    }
                }
                return self; // Allow further .eq() chaining
            },
            in: (col, vals) => {
                // Handle .in() for bulk delete
                vals.forEach(val => self.eq(col, val));
                return self;
            },
            then: (onFulfilled, onRejected) => {
                return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
            }
        };
        return self;
    }


    // This makes the instance "awaitable"
    then(onFulfilled, onRejected) {
        return Promise.resolve({ data: this.data, error: null }).then(onFulfilled, onRejected);
    }

    _toCamelObj(obj) {
        const result = {};
        Object.keys(obj).forEach(key => {
            const camelKey = this._toCamel(key);
            result[camelKey] = obj[key];
        });
        return result;
    }

    _toCamel(str) {
        return str.replace(/([-_][a-z])/g, group => group.toUpperCase().replace('-', '').replace('_', ''));
    }
}

export const offlineSupabase = {
    auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: 'local-user', user_metadata: { nickname: 'Local Dev' }, email: 'dev@local' } } }, error: null }),
        onAuthStateChange: (cb) => {
            setTimeout(() => {
                cb('SIGNED_IN', { user: { id: 'local-user', user_metadata: { nickname: 'Local Dev' }, email: 'dev@local' } });
            }, 0);
            return { data: { subscription: { unsubscribe: () => { } } } };
        },
        signOut: () => Promise.resolve({ error: null }),
    },
    from: (table) => {
        let data = [];
        if (table === 'jobs') data = getJobs();
        else if (table === 'staff') data = getStaff();
        else if (table === 'allocations') data = getAllocations();
        else if (table === 'progress_logs') data = getProgressLogs();
        else if (table === 'log_staff_assignments') data = getLogStaffAssignments();
        else if (table === 'sub_tasks') data = getSubTasks();
        else if (table === 'attachments') data = getAttachments();
        return new MockQueryBuilder(data, table);
    },
    channel: () => ({
        on: function () { return this; },
        subscribe: function () { return this; }
    }),
    removeChannel: () => { }
};
