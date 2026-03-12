import { supabase } from '../lib/supabaseClient';
import { exportAllData, getProgressLogs, getLogStaffAssignments, getSubTasks, getAttachments } from './store';

/**
 * Syncs all localStorage data to Supabase.
 * This is a destructive operation on Supabase (it clears and re-uploads) 
 * OR it can be an 'upsert' operation. For a migration, upsert is safer.
 */
export async function syncToSupabase() {
    const data = exportAllData();
    const results = {
        staff: 0,
        jobs: 0,
        allocations: 0,
        parameters: 0,
        holidays: 0,
        subTasks: 0,
        progressLogs: 0,
        errors: []
    };

    try {
        // 1. Sync Staff
        if (data.staff && data.staff.length > 0) {
            const staffToUpload = data.staff.map(s => ({
                id: s.id,
                fingerprint_id: s.fingerprintId,
                full_name: s.fullName,
                nickname: s.nickname,
                role: s.role,
                primary_skill: s.primarySkill,
                is_active: s.isActive,
                phone: s.phone,
                additional_info: s.additionalInfo,
                created_at: s.createdAt
            }));
            const { error: sErr } = await supabase.from('staff').upsert(staffToUpload);
            if (sErr) results.errors.push(`Staff: ${sErr.message}`);
            else results.staff = staffToUpload.length;
        }

        // 2. Sync Jobs
        if (data.jobs && data.jobs.length > 0) {
            const jobsToUpload = data.jobs.map(j => ({
                id: j.id,
                qt_number: j.qtNumber,
                project_name: j.projectName,
                client_name: j.clientName,
                job_type: j.jobType,
                status: j.status,
                start_date: j.startDate,
                end_date: j.endDate,
                default_check_in: j.defaultCheckIn,
                default_check_out: j.defaultCheckOut,
                priority: j.priority,
                fix_reason: j.fixReason,
                fix_photo: j.fixPhoto,
                notes: j.notes,
                created_by: j.createdBy,
                overall_progress: j.overallProgress,
                current_issues: j.currentIssues,
                current_issues_date: j.currentIssuesDate,
                current_issues_by: j.currentIssuesBy,
                created_at: j.createdAt,
                updated_at: j.updatedAt
            }));
            const { error: jErr } = await supabase.from('jobs').upsert(jobsToUpload);
            if (jErr) results.errors.push(`Jobs: ${jErr.message}`);
            else results.jobs = jobsToUpload.length;
        }

        // 3. Sync Allocations
        if (data.allocations && data.allocations.length > 0) {
            const allocsToUpload = data.allocations.map(a => ({
                id: a.id,
                job_id: a.jobId,
                staff_id: a.staffId,
                date: a.date,
                assigned_hours: a.assignedHours,
                check_in: a.checkIn,
                check_out: a.checkOut,
                actual_hours: a.actualHours,
                overtime_hours: a.overtimeHours,
                task: a.task,
                status: a.status,
                created_at: a.createdAt
            }));
            const { error: aErr } = await supabase.from('allocations').upsert(allocsToUpload);
            if (aErr) results.errors.push(`Allocations: ${aErr.message}`);
            else results.allocations = allocsToUpload.length;
        }

        // 4. Sync Parameters
        if (data.parameters) {
            const p = data.parameters;
            const paramsToUpload = {
                id: p.id || 'default-params',
                work_start_time: p.workStartTime,
                work_end_time: p.workEndTime,
                lunch_break_start: p.lunchBreakStart,
                lunch_break_duration: p.lunchBreakDuration,
                dinner_break_threshold: p.dinnerBreakThreshold,
                dinner_break_duration: p.dinnerBreakDuration,
                ot_rate1: p.otRate1,
                ot_rate1_max_hours: p.otRate1MaxHours,
                ot_rate2: p.otRate2,
                ot_rate3: p.otRate3,
                base_daily_rate: p.baseDailyRate,
                updated_at: new Date().toISOString()
            };
            const { error: pErr } = await supabase.from('parameters').upsert(paramsToUpload);
            if (pErr) results.errors.push(`Parameters: ${pErr.message}`);
            else results.parameters = 1;
        }

        // 5. Sync Holidays
        if (data.holidays && data.holidays.length > 0) {
            const holidaysToUpload = data.holidays.map(h => ({
                id: h.id,
                date: h.date,
                name: h.name,
                type: h.type,
                created_at: h.createdAt || new Date().toISOString()
            }));
            const { error: hErr } = await supabase.from('holidays').upsert(holidaysToUpload);
            if (hErr) results.errors.push(`Holidays: ${hErr.message}`);
            else results.holidays = holidaysToUpload.length;
        }

        // 6. Sync Sub Tasks
        const subTasks = getSubTasks();
        if (subTasks && subTasks.length > 0) {
            const stToUpload = subTasks.map(st => ({
                id: st.id,
                job_id: st.jobId,
                title: st.title,
                is_completed: st.isCompleted
            }));
            const { error: stErr } = await supabase.from('sub_tasks').upsert(stToUpload);
            if (stErr) results.errors.push(`SubTasks: ${stErr.message}`);
            else results.subTasks = stToUpload.length;
        }

        // 7. Sync Progress Logs
        const logs = getProgressLogs();
        if (logs && logs.length > 0) {
            const logsToUpload = logs.map(l => ({
                id: l.id,
                job_id: l.jobId,
                log_date: l.date || l.logDate,
                text: l.text,
                author: l.author
            }));
            const { error: lErr } = await supabase.from('progress_logs').upsert(logsToUpload);
            if (lErr) results.errors.push(`ProgressLogs: ${lErr.message}`);
            else results.progressLogs = logsToUpload.length;

            // Sync Log Staff Assignments if any
            const assignments = getLogStaffAssignments();
            if (assignments && assignments.length > 0) {
                const assToUpload = assignments.map(a => ({
                    id: a.id,
                    log_id: a.logId,
                    staff_id: a.staffId
                }));
                const { error: assErr } = await supabase.from('log_staff_assignments').upsert(assToUpload);
                if (assErr) results.errors.push(`LogAssignments: ${assErr.message}`);
            }
        }

        // 8. Sync Attachments
        const attachments = getAttachments();
        if (attachments && attachments.length > 0) {
            const attToUpload = attachments.map(a => ({
                id: a.id,
                job_id: a.jobId,
                name: a.name,
                url: a.url,
                type: a.type
            }));
            const { error: attErr } = await supabase.from('attachments').upsert(attToUpload);
            if (attErr) results.errors.push(`Attachments: ${attErr.message}`);
        }

    } catch (err) {
        results.errors.push(`Global: ${err.message}`);
    }

    return results;
}
