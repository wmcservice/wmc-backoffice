import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, isSameMonth, isSameDay, addDays, subMonths, addMonths, parseISO, startOfDay, endOfDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { supabase } from '../lib/supabaseClient';
import { JobDetailModal, JobModal } from '../components/JobModals';
import { jobTypeToKey, statusToKey } from '../utils/helpers';
import './JobCalendar.css';

export default function JobCalendar({ user }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [jobs, setJobs] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal states
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailJob, setDetailJob] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingJob, setEditingJob] = useState(null);

    useEffect(() => {
        fetchData();
        fetchStaff();

        const channel = supabase
            .channel('job-calendar-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => fetchData(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'allocations' }, () => fetchData(true))
            .subscribe();

        const handleVisibility = () => { if (document.visibilityState === 'visible') fetchData(true); };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => { supabase.removeChannel(channel); document.removeEventListener('visibilitychange', handleVisibility); };
    }, []);

    useEffect(() => {
        if (detailJob) {
            const fresh = jobs.find(j => j.id === detailJob.id);
            if (fresh) setDetailJob(fresh);
        }
    }, [jobs]);

    const fetchStaff = async () => {
        const { data } = await supabase.from('staff').select('*').eq('is_active', true);
        if (data) setStaff(data.map(s => ({ id: s.id, nickname: s.nickname, fullName: s.full_name, role: s.role })));
    };

    const fetchData = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const { data: allocData } = await supabase.from('allocations').select('job_id, staff_id, task, date');
            const { data, error } = await supabase.from('jobs').select('*, sub_tasks (*), attachments (*), progress_logs (*, log_staff_assignments(staff_id))');
            if (error) throw error;

            const { data: staffData } = await supabase.from('staff').select('id, nickname');
            const staffMap = {};
            (staffData || []).forEach(s => staffMap[s.id] = s.nickname);

            setJobs(data.map(j => {
                const jobAllocs = (allocData || []).filter(a => a.job_id === j.id);
                const uniqueStaffIds = [...new Set(jobAllocs.map(a => a.staff_id))];

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
                    qtNumber: j.qt_number, projectName: j.project_name, clientName: j.client_name, jobType: j.job_type, status: j.status,
                    startDate: j.start_date, endDate: j.end_date, defaultCheckIn: j.default_check_in, defaultCheckOut: j.default_check_out,
                    priority: j.priority, notes: j.notes, createdBy: j.created_by, fixReason: j.fix_reason, overallProgress: j.overall_progress, currentIssues: j.current_issues,
                    createdAt: j.created_at, updatedAt: j.updated_at,
                    subTasks: (j.sub_tasks || []).map(st => ({ id: st.id, title: st.title, isCompleted: st.is_completed })),
                    attachments: (j.attachments || []).map(a => ({ id: a.id, name: a.name, url: a.url, type: a.type })),
                    progressLogs: (j.progress_logs || []).map(pl => ({
                        id: pl.id, date: pl.log_date, text: pl.text, author: pl.author,
                        workerIds: (pl.log_staff_assignments || []).map(lsa => lsa.staff_id)
                    })).sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id),
                    assignedStaffIds: uniqueStaffIds,
                    dailyTasks
                };
            }));
        } catch (error) { console.error(error); } finally { if (!isSilent) setLoading(false); }
    };

    const buildJobObj = (job, jobId) => ({
        ...job,
        id: jobId || job.id,
        updatedAt: new Date().toISOString(),
    });

    const handleSave = async (job) => {
        const isUpdate = !!(editingJob && job.id);
        const updatedAt = new Date().toISOString();
        const createdAt = job.createdAt || updatedAt;
        const tempId = job.id || crypto.randomUUID();
        const dbData = {
            id: isUpdate ? job.id : tempId,
            qt_number: job.qtNumber || '',
            project_name: job.projectName || '',
            client_name: job.clientName || '',
            job_type: job.jobType || 'ติดตั้ง',
            status: job.status || 'รอคิว',
            start_date: job.startDate || new Date().toISOString().split('T')[0],
            end_date: job.endDate || new Date().toISOString().split('T')[0],
            default_check_in: job.defaultCheckIn || '09:00',
            default_check_out: job.defaultCheckOut || '18:00',
            priority: job.priority || 'ปกติ',
            notes: job.notes || '',
            fix_reason: job.fixReason || '',
            created_by: job.createdBy || '',
            overall_progress: job.overallProgress || 0,
            current_issues: job.currentIssues || '',
            updated_at: updatedAt,
            created_at: createdAt
        };

        const optimisticJob = { ...job, id: tempId, updatedAt, createdAt };
        if (isUpdate) {
            setJobs(prev => prev.map(j => j.id === job.id ? optimisticJob : j));
        } else {
            setJobs(prev => [optimisticJob, ...prev]);
        }
        setShowModal(false);
        setEditingJob(null);

        try {
            let jobId = isUpdate ? job.id : tempId;
            if (isUpdate) {
                const { error } = await supabase.from('jobs').update(dbData).eq('id', job.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('jobs').insert([dbData]);
                if (error) throw error;
            }
            
            const newStaffIds = job.assignedStaffIds || [];
            const dates = [];
            let curr = new Date((job.startDate || new Date().toISOString().split('T')[0]) + 'T12:00:00');
            const end = new Date((job.endDate || new Date().toISOString().split('T')[0]) + 'T12:00:00');
            while (curr <= end) {
                dates.push(curr.toISOString().split('T')[0]);
                curr.setDate(curr.getDate() + 1);
            }

            const { data: existing } = await supabase.from('allocations').select('id, staff_id, date').eq('job_id', jobId).in('date', dates);
            const existingAllocs = existing || [];

            const toDelete = existingAllocs.filter(a => !newStaffIds.includes(a.staff_id)).map(a => a.id);
            if (toDelete.length > 0) await supabase.from('allocations').delete().in('id', toDelete);

            if (newStaffIds.length > 0) {
                const allocInserts = [];
                dates.forEach(dStr => {
                    const existingOnDate = existingAllocs.filter(a => a.date === dStr).map(a => a.staff_id);
                    newStaffIds.filter(sid => !existingOnDate.includes(sid)).forEach(sid => {
                        allocInserts.push({ id: crypto.randomUUID(), job_id: jobId, staff_id: sid, date: dStr, status: 'ได้รับมอบหมาย' });
                    });
                });
                if (allocInserts.length > 0) await supabase.from('allocations').insert(allocInserts);
            }

            await supabase.from('sub_tasks').delete().eq('job_id', jobId);
            if (job.subTasks?.length > 0) await supabase.from('sub_tasks').insert(job.subTasks.map(st => ({ id: crypto.randomUUID(), job_id: jobId, title: st.title, is_completed: st.isCompleted })));
            
            fetchData(true);
        } catch (error) {
            console.error('Save error details:', error);
            alert(`บันทึกไม่สำเร็จ: ${error.message || 'Unknown error'}`);
            fetchData(true);
        }
    };

    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const today = () => setCurrentDate(new Date());

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const dateFormat = "d";
    const rows = [];
    let days = [];
    let day = startDate;

    const isJobActiveOnDay = (job, targetDate) => {
        if (!job.startDate) return false;
        const jobStart = parseISO(job.startDate);
        const jobEnd = job.endDate ? parseISO(job.endDate) : jobStart;
        const target = startOfDay(targetDate);
        return target >= startOfDay(jobStart) && target <= startOfDay(jobEnd);
    };

    while (day <= endDate) {
        for (let i = 0; i < 7; i++) {
            const cloneDay = day;
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());
            
            const dayJobs = jobs.filter(j => isJobActiveOnDay(j, cloneDay));

            days.push(
                <div 
                    className={`calendar-day ${!isCurrentMonth ? 'disabled' : ''} ${isToday ? 'today' : ''}`} 
                    key={day.toString()}
                >
                    <div className="calendar-day-header">
                        <span className="calendar-day-num">{format(day, dateFormat)}</span>
                    </div>
                    <div className="calendar-day-content">
                        {dayJobs.map(job => (
                            <div 
                                key={job.id} 
                                className={`calendar-job-pill type-${jobTypeToKey(job.jobType)}`}
                                onClick={(e) => { e.stopPropagation(); setDetailJob(job); setShowDetailModal(true); }}
                                title={`${job.projectName} (${job.jobType})`}
                            >
                                <span className="cjp-name">{job.projectName}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
            day = addDays(day, 1);
        }
        rows.push(
            <div className="calendar-row" key={day.toString()}>
                {days}
            </div>
        );
        days = [];
    }

    const weekdays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const monthName = format(currentDate, 'MMMM yyyy', { locale: th });
    // Add Buddhist Era year formatting
    const yearCE = format(currentDate, 'yyyy');
    const yearBE = parseInt(yearCE) + 543;
    const monthNameTH = format(currentDate, 'MMMM', { locale: th }) + ' ' + yearBE;

    return (
        <div className="page-content">
            <div className="page-header" style={{ marginBottom: '16px' }}>
                <div>
                    <h1>ปฏิทินงาน</h1>
                    <p className="subtitle">ดูภาพรวมคิวงานทั้งหมด</p>
                </div>
            </div>

            <div className="card calendar-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="calendar-toolbar">
                    <button className="btn btn-outline btn-sm" onClick={today}>วันนี้</button>
                    <div className="calendar-nav">
                        <button className="btn btn-ghost btn-icon" onClick={prevMonth}><ChevronLeft size={20} /></button>
                        <h2 className="calendar-title">{monthNameTH}</h2>
                        <button className="btn btn-ghost btn-icon" onClick={nextMonth}><ChevronRight size={20} /></button>
                    </div>
                    {/* Placeholder to balance the flex layout */}
                    <div style={{ width: '48px' }}></div>
                </div>

                <div className="calendar-container">
                    <div className="calendar-weekdays">
                        {weekdays.map(wd => <div key={wd} className="weekday">{wd}</div>)}
                    </div>
                    <div className="calendar-body">
                        {rows}
                    </div>
                </div>
            </div>

            {showDetailModal && detailJob && (
                <JobDetailModal 
                    job={detailJob} 
                    staff={staff} 
                    user={user} 
                    onClose={() => setShowDetailModal(false)} 
                    onUpdate={() => fetchData(true)} 
                    onEdit={() => { setEditingJob(detailJob); setShowModal(true); setShowDetailModal(false); }} 
                />
            )}
            {showModal && (
                <JobModal 
                    job={editingJob} 
                    staff={staff} 
                    clientSuggestions={[]} 
                    onSave={handleSave}
                    onClose={() => { setShowModal(false); setEditingJob(null); }} 
                />
            )}
        </div>
    );
}
