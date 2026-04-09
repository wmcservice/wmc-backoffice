import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, User, X, Clock, MapPin, Briefcase, FileText, Printer, Eye, Edit3, Trash2, Loader2, AlertCircle, Upload, Plus, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { createAllocation, JOB_STATUSES, JOB_TYPES, PRIORITIES, createJob } from '../data/models';
import { getWeekDates, getMonthDates, formatDate, formatDateShort, formatDay, formatMonthYear, getTodayStr, statusToKey, jobTypeToKey, getPriorityColor, getRoleColor, compressImage } from '../utils/helpers';
import { JobModal, JobDetailModal } from '../components/JobModals';
import { addDays, addMonths, startOfMonth, parseISO } from 'date-fns';
import './Scheduler.css';

export default function Scheduler({ user }) {
    const today = getTodayStr();
    const [viewMode, setViewMode] = useState('week');
    const [weekOffset, setWeekOffset] = useState(0);
    const [monthOffset, setMonthOffset] = useState(0);
    const [jobs, setJobs] = useState([]);
    const [allocations, setAllocations] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedJob, setSelectedJob] = useState(null);
    const [showJobModal, setShowJobModal] = useState(false);
    const [editingJob, setEditingJob] = useState(null);

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        if (selectedJob) {
            const freshJob = jobs.find(j => j.id === selectedJob.id);
            if (freshJob) setSelectedJob(freshJob);
        }
    }, [jobs]);

    const fetchData = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const { data: sData } = await supabase.from('staff').select('*').eq('is_active', true);
            setStaff(sData || []);
            const staffMap = {};
            (sData || []).forEach(s => staffMap[s.id] = s.nickname);

            const { data: aData } = await supabase.from('allocations').select('*');
            setAllocations(aData || []);
            const { data: jData } = await supabase.from('jobs').select('*, sub_tasks (*), attachments (*), progress_logs (*, log_staff_assignments(staff_id))').order('created_at', { ascending: false });
            if (jData) {
                setJobs(jData.map(j => {
                    const jobAllocs = (aData || []).filter(a => a.job_id === j.id);
                    const uniqueStaffIds = [...new Set(jobAllocs.map(a => a.staff_id))];

                    // Group allocations by date to get daily tasks
                    const tasksByDate = {};
                    jobAllocs.forEach(a => {
                        if (!tasksByDate[a.date]) tasksByDate[a.date] = { date: a.date, task: a.task, staffNames: [], staffIds: [] };
                        if (staffMap[a.staff_id]) {
                            tasksByDate[a.date].staffNames.push(staffMap[a.staff_id]);
                            tasksByDate[a.date].staffIds.push(a.staff_id);
                        }
                    });
                    const dailyTasks = Object.values(tasksByDate).sort((a, b) => new Date(b.date) - new Date(a.date));

                    return {
                        ...j,
                        qtNumber: j.qt_number, projectName: j.project_name, clientName: j.client_name,
                        jobType: j.job_type, startDate: j.start_date, endDate: j.end_date,
                        priority: j.priority, notes: j.notes, createdBy: j.created_by, fixReason: j.fix_reason,
                        overallProgress: j.overall_progress, currentIssues: j.current_issues, currentIssuesDate: j.current_issues_date, currentIssuesBy: j.current_issues_by,
                        defaultCheckIn: j.default_check_in, defaultCheckOut: j.default_check_out,
                        subTasks: (j.sub_tasks || []).map(st => ({ id: st.id, title: st.title, isCompleted: st.is_completed })),
                        attachments: (j.attachments || []).map(at => ({ id: at.id, name: at.name, url: at.url, type: at.type })),
                        progressLogs: (j.progress_logs || []).map(pl => ({
                            id: pl.id, date: pl.log_date, text: pl.text, author: pl.author,
                            workerIds: (pl.log_staff_assignments || []).map(lsa => lsa.staff_id)
                        })).sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id),
                        assignedStaffIds: uniqueStaffIds,
                        dailyTasks
                    };
                }));
            }
        } catch (err) { console.error(err); } finally { if (!isSilent) setLoading(false); }
    };

    const handleSaveJob = async (job) => {
        const isUpdate = job.id && jobs.some(j => j.id === job.id);
        const updatedAt = new Date().toISOString();
        const dbData = { id: job.id, qt_number: job.qtNumber, project_name: job.projectName, client_name: job.clientName, job_type: job.jobType, status: job.status, start_date: job.startDate, end_date: job.endDate, default_check_in: job.defaultCheckIn, default_check_out: job.defaultCheckOut, priority: job.priority, notes: job.notes, created_by: job.createdBy, overall_progress: job.overallProgress, current_issues: job.currentIssues, updated_at: updatedAt };

        // ── Optimistic update ──────────────────────────
        const optimisticJob = { ...job, updatedAt };
        if (isUpdate) {
            setJobs(prev => prev.map(j => j.id === job.id ? optimisticJob : j));
        } else {
            setJobs(prev => [optimisticJob, ...prev]);
        }
        setShowJobModal(false);
        setEditingJob(null);
        // ──────────────────────────────────────────────

        try {
            let jobId = job.id;
            if (isUpdate) await supabase.from('jobs').update(dbData).eq('id', job.id);
            else { const { data } = await supabase.from('jobs').insert([dbData]).select(); jobId = data[0].id; setJobs(prev => prev.map(j => j.id === job.id ? { ...optimisticJob, id: jobId } : j)); }
            await supabase.from('sub_tasks').delete().eq('job_id', jobId);
            if (job.subTasks?.length > 0) await supabase.from('sub_tasks').insert(job.subTasks.map(st => ({ id: crypto.randomUUID(), job_id: jobId, title: st.title, is_completed: st.isCompleted })));

            // ── Clean up allocations outside the new date range ──
            if (isUpdate && job.startDate && job.endDate) {
                await supabase.from('allocations').delete().eq('job_id', jobId).lt('date', job.startDate);
                await supabase.from('allocations').delete().eq('job_id', jobId).gt('date', job.endDate);
            }

            if (job.assignedStaffIds?.length > 0) {
                const dates = [];
                let curr = new Date(job.startDate + 'T12:00:00');
                const end = new Date(job.endDate + 'T12:00:00');
                while (curr <= end) {
                    dates.push(curr.toISOString().split('T')[0]);
                    curr.setDate(curr.getDate() + 1);
                }
                const { data: existing } = await supabase.from('allocations').select('staff_id, date').eq('job_id', jobId).in('date', dates);
                const allocInserts = [];
                dates.forEach(dStr => {
                    const existingOnDate = (existing || []).filter(a => a.date === dStr).map(a => a.staff_id);
                    const newToAlloc = job.assignedStaffIds.filter(sid => !existingOnDate.includes(sid));
                    newToAlloc.forEach(sid => {
                        allocInserts.push({ id: crypto.randomUUID(), job_id: jobId, staff_id: sid, date: dStr, status: 'ได้รับมอบหมาย' });
                    });
                });
                if (allocInserts.length > 0) await supabase.from('allocations').insert(allocInserts);
            }
        } catch (err) {
            console.error(err);
            alert('Save Failed');
            fetchData(); // Revert on error
        }
    };

    const handleDuplicate = (job) => {
        // Clone job with a fresh id, reset progress & status
        const duplicated = {
            ...job,
            id: crypto.randomUUID(),
            qtNumber: '',           // clear QT number — usually unique per job
            status: 'รอคิว',
            overallProgress: 0,
            currentIssues: '',
            progressLogs: [],
            assignedStaffIds: [...(job.assignedStaffIds || [])], // keep same team
            subTasks: (job.subTasks || []).map(st => ({ ...st, id: crypto.randomUUID(), isCompleted: false })),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setSelectedJob(null);    // close detail modal
        setEditingJob(duplicated); // open JobModal with duplicated data
        setShowJobModal(true);
    };


    const weekDates = useMemo(() => getWeekDates(addDays(new Date(), weekOffset * 7)), [weekOffset]);
    const monthDates = useMemo(() => getMonthDates(addMonths(new Date(), monthOffset)), [monthOffset]);
    const currentRangeDates = viewMode === 'week' ? weekDates : monthDates;
    const uniqueClients = useMemo(() => [...new Set(jobs.map(j => j.clientName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th')), [jobs]);

    if (loading && jobs.length === 0) return <div className="loading-container"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="page-content scheduler-page">
            <div className="page-header">
                <div><h1>ตารางงาน <small style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>v16:40</small></h1><p className="subtitle">มอบหมายงานและติดตามความคืบหน้า</p></div>
                <div className="header-actions">
                    <div className="view-mode-selector"><button className={`view-btn ${viewMode === 'week' ? 'active' : ''}`} onClick={() => setViewMode('week')}>สัปดาห์</button><button className={`view-btn ${viewMode === 'month' ? 'active' : ''}`} onClick={() => setViewMode('month')}>เดือน</button></div>
                    <button className="btn btn-primary" onClick={() => { setEditingJob(null); setShowJobModal(true); }}><Plus size={16} /> เพิ่มงานใหม่</button>
                </div>
            </div>
            <div className="scheduler-container">
                <div className="scheduler-header">
                    <div className="current-range">
                        <button className="btn btn-ghost btn-icon" onClick={() => viewMode === 'week' ? setWeekOffset(prev => prev - 1) : setMonthOffset(prev => prev - 1)}><ChevronLeft size={20} /></button>
                        <h2>{viewMode === 'week' ? `สัปดาห์ที่ ${weekOffset >= 0 ? '+' : ''}${weekOffset}` : formatMonthYear(currentRangeDates[10])}</h2>
                        <button className="btn btn-ghost btn-icon" onClick={() => viewMode === 'week' ? setWeekOffset(prev => prev + 1) : setMonthOffset(prev => prev + 1)}><ChevronRight size={20} /></button>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setWeekOffset(0); setMonthOffset(0); }}>วันนี้</button>
                    </div>
                </div>
                <div className="scheduler-grid">
                    {currentRangeDates.map(dateStr => {
                        // Only include allocations that fall within the job's current date range
                        const dayAllocs = allocations.filter(a => {
                            if (a.date !== dateStr) return false;
                            const job = jobs.find(j => j.id === a.job_id);
                            if (!job) return false;
                            return dateStr >= job.start_date && dateStr <= job.end_date;
                        });
                        const allocJobIds = [...new Set(dayAllocs.map(a => a.job_id))];

                        // Also include jobs whose date range covers this day (even without allocations)
                        const dateRangeJobIds = jobs
                            .filter(j => j.startDate && j.endDate && dateStr >= j.startDate && dateStr <= j.endDate)
                            .map(j => j.id);

                        const uniqueJobIds = [...new Set([...allocJobIds, ...dateRangeJobIds])];

                        return (
                            <div key={dateStr} className={`scheduler-day ${dateStr === today ? 'today' : ''}`}>
                                <div className="day-header"><span className="day-name">{formatDay(dateStr)}</span><div className="day-date">{parseISO(dateStr).getDate()} {dateStr === today && <span className="today-badge">วันนี้</span>}</div></div>
                                <div className="day-content">
                                    {uniqueJobIds.length > 0 ? uniqueJobIds.map(jobId => {
                                        const job = jobs.find(j => j.id === jobId);
                                        if (!job) return null;
                                        const workers = dayAllocs.filter(a => a.job_id === jobId).map(a => staff.find(s => s.id === a.staff_id)).filter(Boolean);
                                        return (
                                            <div key={jobId} className={`scheduler-job-card status-${statusToKey(job.status)}`} onClick={() => setSelectedJob(job)}>
                                                <div className="sj-header"><span className="sj-name">{job.projectName}</span></div>
                                                <div className="sj-meta"><span className="sj-type">{job.jobType}</span><span className="sj-time-range">{job.defaultCheckIn}-{job.defaultCheckOut}</span></div>
                                                <div className="sj-staff">{workers.length > 0 ? workers.map(w => <span key={w.id} className="sj-staff-chip">{w.nickname}</span>) : <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>ยังไม่มีพนักงาน</span>}</div>
                                            </div>
                                        );
                                    }) : <div className="day-empty">ไม่มีงาน</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            {selectedJob && <JobDetailModal job={selectedJob} staff={staff} user={user} onClose={() => setSelectedJob(null)} onEdit={() => { setEditingJob(selectedJob); setShowJobModal(true); setSelectedJob(null); }} onDuplicate={() => handleDuplicate(selectedJob)} onUpdate={() => fetchData(true)} />}
            {(showJobModal || editingJob) && <JobModal job={editingJob} staff={staff} clientSuggestions={uniqueClients} onSave={handleSaveJob} onClose={() => { setShowJobModal(false); setEditingJob(null); }} />}
        </div>
    );
}
