import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Filter, Trash2, Edit3, Eye, ChevronDown, AlertCircle, CheckCircle2, Clock, Loader, Download, Upload, Loader2, AlertTriangle, FileText } from 'lucide-react';
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

    useEffect(() => { fetchData(); fetchStaff(); }, []);

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
            const { data: allocData } = await supabase.from('allocations').select('job_id, staff_id');
            const { data, error } = await supabase.from('jobs').select('*, sub_tasks (*), attachments (*), progress_logs (*, log_staff_assignments(staff_id), attachments(*))').order('created_at', { ascending: false });
            if (error) throw error;
            setJobs(data.map(j => ({
                ...j, 
                qtNumber: j.qt_number, projectName: j.project_name, clientName: j.client_name, jobType: j.job_type, status: j.status, 
                startDate: j.start_date, endDate: j.end_date, defaultCheckIn: j.default_check_in, defaultCheckOut: j.default_check_out, 
                priority: j.priority, notes: j.notes, createdBy: j.created_by, fixReason: j.fix_reason, overallProgress: j.overall_progress, currentIssues: j.current_issues, 
                createdAt: j.created_at, updatedAt: j.updated_at,
                subTasks: (j.sub_tasks || []).map(st => ({ id: st.id, title: st.title, isCompleted: st.is_completed })),
                attachments: (j.attachments || []).map(a => ({ id: a.id, name: a.name, url: a.url, type: a.type })),
                progressLogs: (j.progress_logs || []).map(pl => ({
                    id: pl.id, date: pl.log_date, text: pl.text, author: pl.author, 
                    workerIds: (pl.log_staff_assignments || []).map(lsa => lsa.staff_id),
                    attachments: (pl.attachments || []).map(la => ({ id: la.id, name: la.name, url: la.url, type: la.type }))
                })).sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id),
                assignedStaffIds: [...new Set((allocData || []).filter(a => a.job_id === j.id).map(a => a.staff_id))]
            })));
        } catch (error) { console.error(error); } finally { if (!isSilent) setLoading(false); }
    };

    const handleSave = async (job) => {
        try {
            const dbData = { 
                qt_number: job.qtNumber, project_name: job.projectName, client_name: job.clientName, 
                job_type: job.jobType, status: job.status, start_date: job.startDate, end_date: job.endDate, 
                default_check_in: job.defaultCheckIn, default_check_out: job.defaultCheckOut, 
                priority: job.priority, notes: job.notes, fix_reason: job.fixReason,
                created_by: job.createdBy, overall_progress: job.overallProgress, 
                current_issues: job.currentIssues, updated_at: new Date().toISOString() 
            };
            let jobId = job.id;
            if (editingJob && job.id) await supabase.from('jobs').update(dbData).eq('id', job.id);
            else { const { data } = await supabase.from('jobs').insert([dbData]).select(); jobId = data[0].id; }
            if (job.assignedStaffIds?.length > 0) {
                const { data: existing } = await supabase.from('allocations').select('staff_id').eq('job_id', jobId).eq('date', job.startDate);
                const newToAlloc = job.assignedStaffIds.filter(sid => !(existing || []).map(a => a.staff_id).includes(sid));
                if (newToAlloc.length > 0) await supabase.from('allocations').insert(newToAlloc.map(sid => ({ job_id: jobId, staff_id: sid, date: job.startDate, status: 'ได้รับมอบหมาย' })));
            }
            await supabase.from('sub_tasks').delete().eq('job_id', jobId);
            if (job.subTasks?.length > 0) await supabase.from('sub_tasks').insert(job.subTasks.map(st => ({ job_id: jobId, title: st.title, is_completed: st.isCompleted })));
            fetchData(); setShowModal(false); setEditingJob(null);
        } catch (error) { alert('บันทึกไม่สำเร็จ'); }
    };

    const uniqueClients = useMemo(() => [...new Set(jobs.map(j => j.clientName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th')), [jobs]);
    const filtered = useMemo(() => jobs.filter(j => (!search || (j.projectName || '').toLowerCase().includes(search.toLowerCase()) || (j.clientName || '').toLowerCase().includes(search.toLowerCase()) || (j.qtNumber || '').toLowerCase().includes(search.toLowerCase())) && (statusFilter === 'ทุกสถานะ' || j.status === statusFilter) && (typeFilter === 'ทุกประเภท' || j.jobType === typeFilter)), [jobs, search, statusFilter, typeFilter]);

    return (
        <div className="page-content">
            <div className="page-header">
                <div><h1>จัดการงาน <small style={{fontSize:'10px', opacity:0.5}}>v18:00</small></h1><p className="subtitle">รวม {jobs.length} รายการ</p></div>
                <button className="btn btn-primary" onClick={() => { setEditingJob(null); setShowModal(true); }}><Plus size={16} /> เพิ่มงานใหม่</button>
            </div>
            <div className="filters-bar">
                <div className="search-input"><Search size={16} /><input type="text" placeholder="ค้นหา..." className="input" value={search} onChange={e => setSearch(e.target.value)} /></div>
                <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="ทุกสถานะ">ทุกสถานะ</option>{JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-wrapper"><table className="jobs-table"><thead><tr><th>เลขที่ QT</th><th>ชื่อโปรเจกต์</th><th>ลูกค้า</th><th>ประเภท</th><th>คืบหน้า</th><th>สถานะ</th><th style={{ textAlign: 'right' }}>จัดการ</th></tr></thead><tbody>{filtered.map(job => (
                    <tr key={job.id} onClick={() => { setDetailJob(job); setShowDetailModal(true); }} style={{ cursor: 'pointer' }}>
                        <td style={{ fontFamily: 'monospace' }}>{job.qtNumber || '-'}</td>
                        <td><strong>{job.projectName}</strong></td>
                        <td>{job.clientName}</td>
                        <td><span className={`job-type-badge type-${jobTypeToKey(job.jobType)}`}>{job.jobType}</span></td>
                        <td>{job.overallProgress}%</td>
                        <td><span className={`badge badge-${statusToKey(job.status)}`}>{job.status}</span></td>
                        <td><div className="table-actions" style={{ justifyContent: 'flex-end' }}><button className="btn btn-ghost btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); setEditingJob(job); setShowModal(true); }}><Edit3 size={16} /></button><button className="btn btn-ghost btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); if (confirm('ลบ?')) supabase.from('jobs').delete().eq('id', job.id).then(() => fetchData(true)); }}><Trash2 size={16} /></button></div></td>
                    </tr>
                ))}</tbody></table></div>
            </div>
            {showModal && <JobModal job={editingJob} staff={staff} clientSuggestions={uniqueClients} onSave={handleSave} onClose={() => { setShowModal(false); setEditingJob(null); }} />}
            {showDetailModal && detailJob && <JobDetailModal job={detailJob} staff={staff} user={user} onClose={() => setShowDetailModal(false)} onUpdate={() => fetchData(true)} onEdit={() => { setEditingJob(detailJob); setShowModal(true); setShowDetailModal(false); }} />}
        </div>
    );
}
