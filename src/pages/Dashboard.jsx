import { useState, useMemo, useEffect } from 'react';
import { Briefcase, Users, AlertTriangle, Clock, TrendingUp, CheckCircle2, AlertCircle, CalendarDays, Loader2, Edit3, Trash2, FileText, ExternalLink, Paperclip, Plus, Upload } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { supabase } from '../lib/supabaseClient';
import { getJobs, getStaff, getAllocations, saveJob } from '../data/store';
import { getStatusColor, formatDateShort, getTodayStr, getJobDuration, statusToKey, jobTypeToKey, formatDate, getPriorityColor, getRoleColor, compressImage } from '../utils/helpers';
import { STATUS_COLORS, JOB_STATUSES, JOB_TYPES, PRIORITIES } from '../data/models';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns';
import { JobDetailModal } from '../components/JobModals';
import { StaffDetailModal } from './Staff';
import './Dashboard.css';

export default function Dashboard({ user }) {
    const todayStr = getTodayStr();
    const [period, setPeriod] = useState('week');
    const [customStart, setCustomStart] = useState(todayStr);
    const [customEnd, setCustomEnd] = useState(todayStr);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [selectedJob, setSelectedJob] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [staff, setStaff] = useState([]);
    const [allocations, setAllocations] = useState([]);
    const [loading, setLoading] = useState(true);

    const currentDate = useMemo(() => parseISO(todayStr), [todayStr]);

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        if (selectedJob) {
            const fresh = jobs.find(j => j.id === selectedJob.id);
            if (fresh) setSelectedJob(fresh);
        }
    }, [jobs]);

    const fetchData = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const { data: staffData } = await supabase.from('staff').select('*');
            const staffMap = {};
            if (staffData) {
                setStaff(staffData.map(s => {
                    staffMap[s.id] = s.nickname;
                    return { 
                        id: s.id, 
                        nickname: s.nickname, 
                        fullName: s.full_name, 
                        role: s.role, 
                        isActive: s.is_active,
                        additionalInfo: s.additional_info
                    };
                }));
            }

            const { data: jobsData } = await supabase.from('jobs').select('*, sub_tasks (*), attachments (*), progress_logs (*, log_staff_assignments(staff_id))');
            const { data: allocData } = await supabase.from('allocations').select('*');
            setAllocations(allocData || []);

            if (jobsData) {
                setJobs(jobsData.map(j => {
                    const jobAllocs = (allocData || []).filter(a => a.job_id === j.id);
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
                        id: j.id, qtNumber: j.qt_number, projectName: j.project_name, clientName: j.client_name, jobType: j.job_type, status: j.status, startDate: j.start_date, endDate: j.end_date, priority: j.priority, createdBy: j.created_by, notes: j.notes, fixReason: j.fix_reason, overallProgress: j.overall_progress, currentIssues: j.current_issues, currentIssuesDate: j.current_issues_date, currentIssuesBy: j.current_issues_by, defaultCheckIn: j.default_check_in, defaultCheckOut: j.default_check_out,
                        subTasks: (j.sub_tasks || []).map(st => ({ id: st.id, title: st.title, isCompleted: st.is_completed })),
                        attachments: (j.attachments || []).map(a => ({ id: a.id, name: a.name, url: a.url, type: a.type })),
                        progressLogs: (j.progress_logs || []).map(pl => ({
                            id: pl.id, date: pl.log_date, text: pl.text, author: pl.author,
                            workerIds: (pl.log_staff_assignments || []).map(lsa => lsa.staff_id),
                            attachments: (pl.attachments || []).map(la => ({ id: la.id, name: la.name, url: la.url, type: la.type }))
                        })).sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id),
                        assignedStaffIds: uniqueStaffIds,
                        dailyTasks
                    };
                }));
            }
        } catch (error) { console.error(error); } finally { if (!isSilent) setLoading(false); }
    };

    const handleStatusChange = async (job, newStatus) => {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j)); // Optimistic
        const { error } = await supabase.from('jobs').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', job.id);
        if (error) fetchData(true); // Revert on error
    };

    const dateRange = useMemo(() => {
        try {
            switch (period) {
                case 'day': return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
                case 'week': return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
                case 'month': return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
                case 'year': return { start: startOfYear(currentDate), end: endOfYear(currentDate) };
                case 'custom': return { start: startOfDay(parseISO(customStart)), end: endOfDay(parseISO(customEnd)) };
                default: return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) };
            }
        } catch (e) { return { start: new Date(), end: new Date() }; }
    }, [period, currentDate, customStart, customEnd]);

    const stats = useMemo(() => {
        const isInPeriod = (date) => date ? isWithinInterval(parseISO(date), dateRange) : false;
        const periodAllocs = (allocations || []).filter(a => isInPeriod(a?.date));
        const activeJobs = (jobs || []).filter(j => (isInPeriod(j?.startDate) || isInPeriod(j?.endDate) || (j?.startDate && parseISO(j.startDate) <= dateRange.start && j?.endDate && parseISO(j.endDate) >= dateRange.end)) && j?.status !== 'เสร็จสมบูรณ์');
        const totalProgress = activeJobs.reduce((sum, j) => sum + (j?.overallProgress || 0), 0);
        return { activeJobs, avgProgress: activeJobs.length > 0 ? Math.round(totalProgress / activeJobs.length) : 0, periodAllocs };
    }, [jobs, allocations, dateRange]);

    const statusData = useMemo(() => {
        const counts = {};
        (jobs || []).forEach(j => { if (j?.status) counts[j.status] = (counts[j.status] || 0) + 1; });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [jobs]);

    const heatmapData = useMemo(() => {
        return (staff || []).filter(s => s?.isActive).map(s => {
            const staffAllocs = (stats?.periodAllocs || []).filter(a => a?.staff_id === s?.id);
            return { ...s, totalHours: staffAllocs.reduce((sum, a) => sum + (a?.actual_hours || a?.assigned_hours || 0), 0) };
        }).sort((a, b) => b.totalHours - a.totalHours);
    }, [staff, stats.periodAllocs]);

    if (loading && jobs.length === 0) return <div className="page-content flex-center"><Loader2 className="animate-spin" size={48} /></div>;

    return (
        <div className="page-content">
            <div className="page-header">
                <div><h1>ศูนย์ควบคุมปฏิบัติการ <small style={{ fontSize: '10px', opacity: 0.5 }}>v18:00</small></h1><p className="subtitle">ภาพรวม {formatDate(dateRange.start.toISOString())} - {formatDate(dateRange.end.toISOString())}</p></div>
                <div className="period-selector">{['day', 'week', 'month', 'year', 'custom'].map(p => (<button key={p} className={`period-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>{p === 'day' ? 'วัน' : p === 'week' ? 'สัปดาห์' : p === 'month' ? 'เดือน' : p === 'year' ? 'ปี' : 'เลือกเอง'}</button>))}</div>
            </div>

            <div className="kpi-grid">
                <div className="kpi-card blue"><div className="kpi-label">งานในช่วงนี้</div><div className="kpi-value">{stats.activeJobs.length}</div></div>
                <div className="kpi-card cyan"><div className="kpi-label">ความคืบหน้าเฉลี่ย</div><div className="kpi-value">{stats.avgProgress}%</div></div>
                <div className="kpi-card yellow"><div className="kpi-label">พนักงานว่าง</div><div className="kpi-value">{heatmapData.filter(s => s.totalHours === 0).length}</div></div>
            </div>

            <div className="dashboard-grid" style={{ marginTop: '20px' }}>
                <div className="card">
                    <div className="card-header"><h3>สถานะงาน</h3></div>
                    <div className="card-body">
                        <ResponsiveContainer width="100%" height={250}><PieChart><Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{statusData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.name] || '#ccc'} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
                    </div>
                </div>
                <div className="card">
                    <div className="card-header"><h3>พนักงาน (ชม. งาน)</h3></div>
                    <div className="card-body"><div className="heatmap-grid">{heatmapData.slice(0, 12).map(s => (<div key={s.id} className="heatmap-cell" onClick={() => setSelectedStaff(s)} style={{ cursor: 'pointer' }}><div className="heatmap-avatar">{s.nickname.charAt(0)}</div><div className="heatmap-info"><span>{s.nickname}</span><small>{s.totalHours} ชม.</small></div></div>))}</div></div>
                </div>
            </div>

            <div className="card" style={{ marginTop: '20px' }}>
                <div className="card-header"><h3>งานทั้งหมด ({jobs.length} งาน)</h3></div>
                <div className="card-body" style={{ padding: 0 }}>
                    <div className="table-wrapper"><table style={{ width: '100%' }}><thead><tr><th style={{ padding: '12px' }}>เลขที่ QT</th><th>โปรเจกต์</th><th>ลูกค้า</th><th>ประเภท</th><th>สถานะ</th><th>คืบหน้า</th><th>ระยะเวลา</th></tr></thead><tbody>{(jobs || []).map(job => (<tr key={job.id} onClick={() => setSelectedJob(job)} style={{ cursor: 'pointer' }}><td style={{ padding: '12px', fontWeight: 600 }}>{job.qtNumber || '-'}</td><td><strong>{job.projectName}</strong></td><td>{job.clientName}</td><td><span className={`badge badge-${jobTypeToKey(job.jobType)}`} style={{ fontSize: '11px' }}>{job.jobType}</span></td><td><span className={`badge badge-${statusToKey(job.status)}`}>{job.status}</span></td><td>{job.overallProgress || 0}%</td><td style={{ fontSize: '12px' }}>{formatDate(job.startDate)} - {formatDate(job.endDate)}</td></tr>))}</tbody></table></div>
                </div>
            </div>

            {selectedStaff && <StaffDetailModal staffMember={selectedStaff} jobs={jobs} onClose={() => setSelectedStaff(null)} onJobClick={(job) => setSelectedJob(job)} />}
            {selectedJob && <JobDetailModal job={selectedJob} staff={staff} user={user} onClose={() => setSelectedJob(null)} onStatusChange={handleStatusChange} onUpdate={() => fetchData(true)} />}
        </div>
    );
}
