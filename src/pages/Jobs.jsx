import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Filter, Trash2, Edit3, Eye, ChevronDown, AlertCircle, CheckCircle2, Clock, Loader, Download, Upload, Loader2, AlertTriangle, FileText, ArrowUpDown, Copy } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getJobs, saveJob, deleteJob, getStaff, getAllocationsByJob, importJobs, exportAllData } from '../data/store';
import { createJob, JOB_STATUSES, JOB_TYPES, PRIORITIES } from '../data/models';
import { formatDate, getStatusColor, getPriorityColor, statusToKey, jobTypeToKey, compressImage } from '../utils/helpers';
import { JobModal, JobDetailModal } from '../components/JobModals';
import { read, utils, writeFile } from 'xlsx';
import './Jobs.css';

export default function Jobs({ user }) {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ทุกสถานะ');
    const [typeFilter, setTypeFilter] = useState('ทุกประเภท');
    const [showModal, setShowModal] = useState(false);
    const [editingJob, setEditingJob] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailJob, setDetailJob] = useState(null);
    const [staff, setStaff] = useState([]);
    const [sortBy, setSortBy] = useState('newest');

    useEffect(() => {
        fetchData();
        fetchStaff();

        // ── Realtime: auto-refresh when any device saves/edits/deletes ──
        const channel = supabase
            .channel('jobs-page-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => fetchData(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'allocations' }, () => fetchData(true))
            .subscribe();

        // ── visibilitychange: re-fetch when mobile user switches back to app ──
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
            const { data, error } = await supabase.from('jobs').select('*, sub_tasks (*), attachments (*), progress_logs (*, log_staff_assignments(staff_id))').order('created_at', { ascending: false });
            if (error) throw error;

            const { data: staffData } = await supabase.from('staff').select('id, nickname');
            const staffMap = {};
            (staffData || []).forEach(s => staffMap[s.id] = s.nickname);

            setJobs(data.map(j => {
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
                    ...j,
                    qtNumber: j.qt_number, projectName: j.project_name, clientName: j.client_name, jobType: j.job_type, status: j.status,
                    startDate: j.start_date, endDate: j.end_date, defaultCheckIn: j.default_check_in, defaultCheckOut: j.default_check_out,
                    priority: j.priority, notes: j.notes, createdBy: j.created_by, fixReason: j.fix_reason, overallProgress: j.overall_progress, currentIssues: j.current_issues, currentIssuesDate: j.current_issues_date, currentIssuesBy: j.current_issues_by,
                    createdAt: j.created_at, updatedAt: j.updated_at,
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
        const dbData = {
            id: job.id,
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
            created_at: job.createdAt || updatedAt
        };

        // ── Optimistic update ──────────────────────────
        const optimisticJob = { ...job, updatedAt };
        if (isUpdate) {
            setJobs(prev => prev.map(j => j.id === job.id ? optimisticJob : j));
        } else {
            setJobs(prev => [optimisticJob, ...prev]);
        }
        setShowModal(false);
        setEditingJob(null);
        // ──────────────────────────────────────────────

        try {
            let jobId = job.id;
            if (isUpdate) {
                const { error } = await supabase.from('jobs').update(dbData).eq('id', job.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('jobs').insert([dbData]).select();
                if (error) throw error;
                if (!data || data.length === 0) throw new Error('No data returned from insert');
                jobId = data[0].id;
                // Update the temp entry with real server id
                setJobs(prev => prev.map(j => j.id === job.id ? { ...optimisticJob, id: jobId } : j));
            }
            // ── Sync staff allocations: delete removed, insert added ──────
            const newStaffIds = job.assignedStaffIds || [];
            const dates = [];
            let curr = new Date((job.startDate || new Date().toISOString().split('T')[0]) + 'T12:00:00');
            const end = new Date((job.endDate || new Date().toISOString().split('T')[0]) + 'T12:00:00');
            while (curr <= end) {
                dates.push(curr.toISOString().split('T')[0]);
                curr.setDate(curr.getDate() + 1);
            }

            // 1. Get all existing allocations for this job in the date range
            const { data: existing } = await supabase.from('allocations').select('id, staff_id, date').eq('job_id', jobId).in('date', dates);
            const existingAllocs = existing || [];

            // 2. Delete allocations for staff no longer in the list
            const toDelete = existingAllocs.filter(a => !newStaffIds.includes(a.staff_id)).map(a => a.id);
            if (toDelete.length > 0) await supabase.from('allocations').delete().in('id', toDelete);

            // 3. Insert allocations for newly added staff (skip if already exists)
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
            // ─────────────────────────────────────────────────────────────

            await supabase.from('sub_tasks').delete().eq('job_id', jobId);
            if (job.subTasks?.length > 0) await supabase.from('sub_tasks').insert(job.subTasks.map(st => ({ id: crypto.randomUUID(), job_id: jobId, title: st.title, is_completed: st.isCompleted })));
        } catch (error) {
            console.error('Save error details:', error);
            alert(`บันทึกไม่สำเร็จ: ${error.message || 'Unknown error'}`);
            // Revert optimistic update on failure
            fetchData(true);
        }
    };

    const handleDuplicate = (job) => {
        const duplicated = {
            ...job,
            id: crypto.randomUUID(),
            qtNumber: '',
            status: 'รอคิว',
            overallProgress: 0,
            currentIssues: '',
            progressLogs: [],
            assignedStaffIds: [...(job.assignedStaffIds || [])],
            subTasks: (job.subTasks || []).map(st => ({ ...st, id: crypto.randomUUID(), isCompleted: false })),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setShowDetailModal(false);
        setEditingJob(duplicated);
        setShowModal(true);
    };

    const uniqueClients = useMemo(() => [...new Set(jobs.map(j => j.clientName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th')), [jobs]);
    const filtered = useMemo(() => {
        let result = jobs.filter(j => (!search || (j.projectName || '').toLowerCase().includes(search.toLowerCase()) || (j.clientName || '').toLowerCase().includes(search.toLowerCase()) || (j.qtNumber || '').toLowerCase().includes(search.toLowerCase())) && (statusFilter === 'ทุกสถานะ' || j.status === statusFilter) && (typeFilter === 'ทุกประเภท' || j.jobType === typeFilter));
        switch (sortBy) {
            case 'name-asc': result.sort((a, b) => (a.projectName || '').localeCompare(b.projectName || '', 'th')); break;
            case 'name-desc': result.sort((a, b) => (b.projectName || '').localeCompare(a.projectName || '', 'th')); break;
            case 'client-asc': result.sort((a, b) => (a.clientName || '').localeCompare(b.clientName || '', 'th')); break;
            case 'client-desc': result.sort((a, b) => (b.clientName || '').localeCompare(a.clientName || '', 'th')); break;
            case 'progress-asc': result.sort((a, b) => (a.overallProgress || 0) - (b.overallProgress || 0)); break;
            case 'progress-desc': result.sort((a, b) => (b.overallProgress || 0) - (a.overallProgress || 0)); break;
            case 'qt-asc': result.sort((a, b) => (a.qtNumber || '').localeCompare(b.qtNumber || '')); break;
            case 'qt-desc': result.sort((a, b) => (b.qtNumber || '').localeCompare(a.qtNumber || '')); break;
            case 'oldest': result.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')); break;
            case 'newest': default: result.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); break;
        }
        return result;
    }, [jobs, search, statusFilter, typeFilter, sortBy]);

    const handleSort = (col) => {
        if (sortBy === col + '-asc') setSortBy(col + '-desc');
        else setSortBy(col + '-asc');
    };
    const sortArrow = (col) => {
        if (sortBy === col + '-asc') return ' ▲';
        if (sortBy === col + '-desc') return ' ▼';
        return '';
    };
    const thStyle = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };

    return (
        <div className="page-content">
            <div className="page-header">
                <div><h1>จัดการงาน <small style={{ fontSize: '10px', opacity: 0.5 }}>v18:00</small></h1><p className="subtitle">รวม {jobs.length} รายการ</p></div>
                <button className="btn btn-primary" onClick={() => { setEditingJob(null); setShowModal(true); }}><Plus size={16} /> เพิ่มงานใหม่</button>
            </div>
            <div className="filters-bar">
                <div className="search-input"><Search size={16} /><input type="text" placeholder="ค้นหา..." className="input" value={search} onChange={e => setSearch(e.target.value)} /></div>
                <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="ทุกสถานะ">ทุกสถานะ</option>{JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                <select className="select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="ทุกประเภท">ทุกประเภท</option>{JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
            </div>

            {/* Desktop Table */}
            <div className="card jobs-desktop-table" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-wrapper"><table className="jobs-table"><thead><tr>
                    <th style={thStyle} onClick={() => handleSort('qt')}>เลขที่ QT{sortArrow('qt')}</th>
                    <th style={thStyle} onClick={() => handleSort('name')}>ชื่อโปรเจกต์{sortArrow('name')}</th>
                    <th style={thStyle} onClick={() => handleSort('client')}>ลูกค้า{sortArrow('client')}</th>
                    <th>ประเภท</th>
                    <th style={thStyle} onClick={() => handleSort('progress')}>คืบหน้า{sortArrow('progress')}</th>
                    <th>สถานะ</th>
                    <th style={{ textAlign: 'right' }}>จัดการ</th>
                </tr></thead><tbody>{filtered.map(job => (
                    <tr key={job.id} onClick={() => { setDetailJob(job); setShowDetailModal(true); }} style={{ cursor: 'pointer' }}>
                        <td style={{ fontFamily: 'monospace' }}>{job.qtNumber || '-'}</td>
                        <td><strong>{job.projectName}</strong>{job.currentIssues && <span title={job.currentIssues} style={{ marginLeft: '6px', color: '#d97706', cursor: 'help' }}>⚠️</span>}</td>
                        <td>{job.clientName}</td>
                        <td><span className={`job-type-badge type-${jobTypeToKey(job.jobType)}`}>{job.jobType}</span></td>
                        <td>{job.overallProgress}%</td>
                        <td><span className={`badge badge-${statusToKey(job.status)}`}>{job.status}</span></td>
                        <td><div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost btn-icon btn-sm" title="สร้างงานซ้ำ" onClick={(e) => { e.stopPropagation(); handleDuplicate(job); }}><Copy size={16} /></button>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); setEditingJob(job); setShowModal(true); }}><Edit3 size={16} /></button>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); if (confirm('ลบ?')) { setJobs(prev => prev.filter(j => j.id !== job.id)); supabase.from('jobs').delete().eq('id', job.id).then(({ error }) => { if (error) { alert('ลบไม่สำเร็จ'); fetchData(true); } }); } }}><Trash2 size={16} /></button>
                        </div></td>
                    </tr>
                ))}</tbody></table></div>
            </div>

            {/* Mobile Card List */}
            <div className="jobs-mobile-list">
                {filtered.map(job => (
                    <div
                        key={job.id}
                        className={`job-mobile-card type-${jobTypeToKey(job.jobType)}`}
                        onClick={() => { setDetailJob(job); setShowDetailModal(true); }}
                    >
                        <div className="jmc-top">
                            <div className="jmc-title">
                                <div className="jmc-name-row">
                                    <strong>{job.projectName}</strong>
                                    {job.currentIssues && <span style={{ color: '#d97706', fontSize: '14px' }}>⚠️</span>}
                                </div>
                                <div className="jmc-sub-row">
                                    {job.qtNumber && <span className="jmc-qt">{job.qtNumber}</span>}
                                    <span className="jmc-sep">·</span>
                                    <span className="jmc-client-inline">{job.clientName}</span>
                                </div>
                            </div>
                            <div className="jmc-actions" onClick={e => e.stopPropagation()}>
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditingJob(job); setShowModal(true); }}><Edit3 size={15} /></button>
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { if (confirm('ลบ?')) { setJobs(prev => prev.filter(j => j.id !== job.id)); supabase.from('jobs').delete().eq('id', job.id).then(({ error }) => { if (error) { alert('ลบไม่สำเร็จ'); fetchData(true); } }); } }}><Trash2 size={15} /></button>
                            </div>
                        </div>
                        <div className="jmc-meta">
                            <span className={`badge badge-${statusToKey(job.status)}`}>{job.status}</span>
                            <span className={`job-type-badge type-${jobTypeToKey(job.jobType)}`}>{job.jobType}</span>
                            <span className="jmc-dates">{job.startDate ? job.startDate.slice(5).replace('-', '/') : ''}{job.endDate && job.endDate !== job.startDate ? ` – ${job.endDate.slice(5).replace('-', '/')}` : ''}</span>
                        </div>
                        <div className="jmc-progress-bar-wrap">
                            <div className="jmc-progress-bar" style={{ width: `${job.overallProgress || 0}%` }} />
                            <span className="jmc-progress-label">{job.overallProgress || 0}%</span>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="empty-state"><p>ไม่พบรายการงาน</p></div>

                )}
            </div>

            {showModal && <JobModal job={editingJob} staff={staff} clientSuggestions={uniqueClients} onSave={handleSave} onClose={() => { setShowModal(false); setEditingJob(null); }} />}
            {showDetailModal && detailJob && <JobDetailModal job={detailJob} staff={staff} user={user} onClose={() => setShowDetailModal(false)} onUpdate={() => fetchData(true)} onEdit={() => { setEditingJob(detailJob); setShowModal(true); setShowDetailModal(false); }} onDuplicate={() => handleDuplicate(detailJob)} />}
        </div>
    );
}
