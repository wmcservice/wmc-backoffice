import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, X, Link, FileText, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { createJob, JOB_STATUSES, JOB_TYPES, PRIORITIES } from '../data/models';
import { formatDate, getStatusColor, getPriorityColor, statusToKey, jobTypeToKey } from '../utils/helpers';
import TimeInput24 from './TimeInput24';
import DateInputDMY from './DateInputDMY';

export function JobModal({ job, staff, clientSuggestions = [], onSave, onClose }) {
    const [form, setForm] = useState(job ? { ...job, assignedStaffIds: job.assignedStaffIds || [] } : createJob());
    const [selectionType, setSelectionType] = useState(['พี่ยุ้ย', 'แพร', 'ไอซ์'].includes(form.createdBy) ? form.createdBy : (form.createdBy ? 'อื่นๆ' : ''));
    const [subTaskInput, setSubTaskInput] = useState('');

    const update = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

    const handleAddSubTask = () => {
        if (!subTaskInput.trim()) return;
        const ut = [...(form.subTasks || []), { id: Date.now(), title: subTaskInput.trim(), isCompleted: false }];
        update('subTasks', ut);
        setSubTaskInput('');
        update('overallProgress', ut.length > 0 ? Math.round((ut.filter(t => t.isCompleted).length / ut.length) * 100) : 0);
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal" style={{ maxWidth: '750px' }}>
                <div className="modal-header">
                    <h2>{job ? 'แก้ไขงาน' : 'เพิ่มงานใหม่'}</h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="modal-body">
                    <div className="form-grid">
                        <div className="input-group">
                            <label>เลขที่ QT</label>
                            <input className="input" value={form.qtNumber} onChange={e => update('qtNumber', e.target.value)} />
                        </div>
                        <div className="input-group">
                            <label>ชื่อโปรเจกต์</label>
                            <input className="input" value={form.projectName} onChange={e => update('projectName', e.target.value)} />
                        </div>
                        <div className="input-group">
                            <label>ชื่อลูกค้า</label>
                            <input className="input" value={form.clientName} onChange={e => update('clientName', e.target.value)} list="cl-list" />
                            <datalist id="cl-list">
                                {clientSuggestions.map(c => <option key={c} value={c} />)}
                            </datalist>
                        </div>
                        <div className="input-group">
                            <label>เซลล์ที่รับผิดชอบ</label>
                            <select className="select" value={selectionType} onChange={e => {
                                setSelectionType(e.target.value);
                                if (e.target.value !== 'อื่นๆ') update('createdBy', e.target.value);
                            }}>
                                <option value="">เลือกผู้ลงชื่อ</option>
                                <option value="พี่ยุ้ย">พี่ยุ้ย</option>
                                <option value="แพร">แพร</option>
                                <option value="ไอซ์">ไอซ์</option>
                                <option value="อื่นๆ">อื่นๆ</option>
                            </select>
                            {selectionType === 'อื่นๆ' && (
                                <input className="input" style={{ marginTop: '8px' }} value={form.createdBy} onChange={e => update('createdBy', e.target.value)} />
                            )}
                        </div>
                        <div className="input-group">
                            <label>ประเภทงาน</label>
                            <select className="select" value={form.jobType} onChange={e => update('jobType', e.target.value)}>
                                {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="input-group">
                            <label>ความสำคัญ</label>
                            <select className="select" value={form.priority} onChange={e => update('priority', e.target.value)}>
                                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div className="input-group">
                            <label>สถานะ</label>
                            <select className="select" value={form.status} onChange={e => update('status', e.target.value)}>
                                {JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="form-row">
                            <div className="input-group">
                                <label>วันที่เริ่ม</label>
                                <DateInputDMY value={form.startDate} onChange={e => update('startDate', e.target.value)} />
                            </div>
                            <div className="input-group">
                                <label>วันที่สิ้นสุด</label>
                                <DateInputDMY value={form.endDate} onChange={e => update('endDate', e.target.value)} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="input-group">
                                <label>เวลาเข้างาน</label>
                                <TimeInput24 value={form.defaultCheckIn} onChange={e => update('defaultCheckIn', e.target.value)} />
                            </div>
                            <div className="input-group">
                                <label>เวลาเลิกงาน</label>
                                <TimeInput24 value={form.defaultCheckOut} onChange={e => update('defaultCheckOut', e.target.value)} />
                            </div>
                        </div>
                        <div className="input-group full-width" style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
                            <label>รายการงานย่อย</label>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                <input className="input" placeholder="เพิ่ม..." value={subTaskInput} onChange={e => setSubTaskInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddSubTask()} />
                                <button className="btn btn-secondary" onClick={handleAddSubTask}>+ เพิ่ม</button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {(form.subTasks || []).map(t => (
                                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                                        <input type="checkbox" checked={t.isCompleted} onChange={e => {
                                            const ut = form.subTasks.map(st => st.id === t.id ? { ...st, isCompleted: e.target.checked } : st);
                                            update('subTasks', ut);
                                            update('overallProgress', Math.round((ut.filter(x => x.isCompleted).length / ut.length) * 100));
                                        }} />
                                        <span>{t.title}</span>
                                        <button onClick={() => update('subTasks', form.subTasks.filter(st => st.id !== t.id))} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="input-group full-width" style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
                            <label>ทีมงานประจำโปรเจกต์</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {staff.map(s => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => update('assignedStaffIds', (form.assignedStaffIds || []).includes(s.id) ? form.assignedStaffIds.filter(id => id !== s.id) : [...(form.assignedStaffIds || []), s.id])}
                                        className={`staff-toggle-btn ${(form.assignedStaffIds || []).includes(s.id) ? 'active' : ''}`}
                                        style={{
                                            padding: '4px 12px',
                                            borderRadius: '20px',
                                            border: '1px solid',
                                            borderColor: (form.assignedStaffIds || []).includes(s.id) ? 'var(--brand-primary)' : 'var(--border-primary)',
                                            background: (form.assignedStaffIds || []).includes(s.id) ? 'var(--brand-primary)' : 'transparent',
                                            color: (form.assignedStaffIds || []).includes(s.id) ? '#fff' : 'inherit',
                                            fontSize: '12px'
                                        }}
                                    >
                                        {s.nickname}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="input-group full-width">
                            <label>สาเหตุที่ต้องแก้ไข (กรณีสถานะคือต้องแก้ไข)</label>
                            <textarea className="textarea" value={form.fixReason} onChange={e => update('fixReason', e.target.value)} placeholder="ระบุเหตุผลที่ต้องกลับไปแก้ไขงาน..." />
                        </div>
                        <div className="input-group full-width">
                            <label>หมายเหตุ</label>
                            <textarea className="textarea" value={form.notes} onChange={e => update('notes', e.target.value)} />
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
                    <button className="btn btn-primary" onClick={() => onSave(form)}>บันทึก</button>
                </div>
            </div>
        </div>
    );
}

export function JobDetailModal({ job, staff, user, onClose, onUpdate, onStatusChange, onEdit }) {
    const statusClass = statusToKey(job.status);
    const [isAdding, setIsAdding] = useState(false);
    const [newLog, setNewLog] = useState('');
    const [logStaffIds, setLogStaffIds] = useState(job.assignedStaffIds || []);
    const [localIssues, setLocalIssues] = useState(job.currentIssues || '');
    const [issueSuccess, setIssueSuccess] = useState(false);

    useEffect(() => {
        setLocalIssues(job.currentIssues || '');
        setLogStaffIds(job.assignedStaffIds || []);
    }, [job.id, job.assignedStaffIds]);

    const handleUpdateIssues = async () => {
        try {
            const isClearing = !localIssues.trim();
            const reporterName = user?.user_metadata?.nickname || user?.email?.split('@')[0] || 'Admin';
            const updatePayload = isClearing
                ? { current_issues: '', current_issues_date: null, current_issues_by: null }
                : { current_issues: localIssues.trim(), current_issues_date: new Date().toISOString(), current_issues_by: reporterName };
            await supabase.from('jobs').update(updatePayload).eq('id', job.id);
            onUpdate();
            setIssueSuccess(true);
            setTimeout(() => setIssueSuccess(false), 3000);
        } catch (error) {
            console.error('Error updating issues:', error);
            alert('เกิดข้อผิดพลาด กรุณาลองอีกครั้ง');
        }
    };

    const handleDeleteIssues = async () => {
        if (!confirm('ต้องการลบปัญหานี้หรือไม่?')) return;
        try {
            await supabase.from('jobs').update({ current_issues: '', current_issues_date: null }).eq('id', job.id);
            setLocalIssues('');
            onUpdate();
        } catch (error) {
            console.error('Error deleting issues:', error);
        }
    };

    const handleAddLog = async () => {
        if (!newLog.trim()) return;
        const authorName = user?.user_metadata?.nickname || user?.email?.split('@')[0] || 'Admin';
        try {
            const { data, error } = await supabase.from('progress_logs').insert([{ job_id: job.id, log_date: new Date().toISOString().split('T')[0], text: newLog, author: authorName }]).select();
            if (error) throw error;
            const logId = data[0].id;
            if (logStaffIds.length > 0) {
                await supabase.from('log_staff_assignments').insert(logStaffIds.map(sid => ({ log_id: logId, staff_id: sid })));
            }
            setNewLog('');
            onUpdate();
        } catch (error) { console.error('Error adding log:', error); }
    };

    const handleDeleteLog = async (logId) => {
        if (!confirm('ต้องการลบบันทึกนี้หรือไม่?')) return;
        try {
            await supabase.from('progress_logs').delete().eq('id', logId);
            onUpdate();
        } catch (error) { console.error(error); }
    };

    const handleAddMember = async (staffId) => {
        if (!staffId) return;
        try {
            // Check if already assigned on this date
            await supabase.from('allocations').insert([{ job_id: job.id, staff_id: staffId, date: new Date().toISOString().split('T')[0], status: 'ได้รับมอบหมาย' }]);
            onUpdate();
            setIsAdding(false);
        } catch (error) { console.error(error); }
    };

    const handleRemoveMember = async (staffId) => {
        if (!confirm('ต้องการลบทีมงาน?')) return;
        try {
            // Delete ALL allocations for this staff on this job (not just today's)
            await supabase.from('allocations').delete().eq('job_id', job.id).eq('staff_id', staffId);
            onUpdate();
        } catch (error) { console.error(error); }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal" style={{ maxWidth: '750px' }}>
                <div className="modal-header">
                    <div>
                        <h2>{job.projectName}</h2>
                        <span className="subtitle">{job.qtNumber} • {job.clientName}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {onEdit && <button className="btn btn-ghost btn-icon" onClick={onEdit}><Edit3 size={18} /></button>}
                        <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                    </div>
                </div>
                <div className="modal-body">
                    <div className="detail-row">
                        <span className={`badge badge-${statusClass}`}>{job.status}</span>
                        <span className="job-type-tag">{job.jobType}</span>
                        <span style={{ color: getPriorityColor(job.priority), fontWeight: 600 }}>{job.priority}</span>
                        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                            <div className="subtitle" style={{ fontSize: '12px' }}>{formatDate(job.startDate)} - {formatDate(job.endDate)}</div>
                            <div className="subtitle" style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 600 }}>🕒 {job.defaultCheckIn} - {job.defaultCheckOut}</div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                        <span><strong>เลขที่ QT:</strong> <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{job.qtNumber || '-'}</span></span>
                        <span><strong>ชื่อลูกค้า:</strong> {job.clientName || '-'}</span>
                        <span><strong>เซลล์ผู้รับผิดชอบ:</strong> {job.createdBy || '-'}</span>
                    </div>

                    <div className="detail-section" style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                            <h4 style={{ margin: 0 }}>ความคืบหน้า: {job.overallProgress}%</h4>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={job.overallProgress}
                                onChange={async e => {
                                    const val = parseInt(e.target.value);
                                    await supabase.from('jobs').update({ overall_progress: val, status: val === 100 ? 'เสร็จสมบูรณ์' : job.status }).eq('id', job.id);
                                    onUpdate();
                                }}
                                style={{ width: '200px' }}
                            />
                        </div>
                        {(job.subTasks || []).length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                {job.subTasks.map(t => (
                                    <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#fff', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border-primary)' }}>
                                        <input
                                            type="checkbox"
                                            checked={t.isCompleted}
                                            onChange={async (e) => {
                                                const ut = job.subTasks.map(st => st.id === t.id ? { ...st, isCompleted: e.target.checked } : st);
                                                const prog = Math.round((ut.filter(x => x.isCompleted).length / ut.length) * 100);
                                                await supabase.from('jobs').update({ overall_progress: prog, status: prog === 100 ? 'เสร็จสมบูรณ์' : job.status }).eq('id', job.id);
                                                await supabase.from('sub_tasks').delete().eq('job_id', job.id);
                                                await supabase.from('sub_tasks').insert(ut.map(x => ({ job_id: job.id, title: x.title, is_completed: x.isCompleted })));
                                                onUpdate();
                                            }}
                                        />
                                        <span style={{ fontSize: '14px', textDecoration: t.isCompleted ? 'line-through' : 'none', color: t.isCompleted ? 'var(--text-tertiary)' : 'inherit' }}>{t.title}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                        {job.currentIssues && (
                            <div style={{ padding: '10px 14px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', marginBottom: '10px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                <AlertCircle size={16} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
                                <div style={{ fontSize: '13px', color: '#92400e', lineHeight: '1.5', flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                        <strong>ปัญหาปัจจุบัน:</strong>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {job.currentIssuesDate && <span style={{ fontSize: '11px', color: '#b45309' }}>{job.currentIssuesBy && <strong>{job.currentIssuesBy}</strong>}{job.currentIssuesBy && ' • '}อัปเดตเมื่อ: {new Date(job.currentIssuesDate).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                                            <button onClick={() => { setLocalIssues(job.currentIssues); document.getElementById('issue-input')?.focus(); }} style={{ border: 'none', background: 'transparent', color: '#b45309', cursor: 'pointer', padding: '2px', display: 'flex' }} title="แก้ไข"><Edit3 size={13} /></button>
                                            <button onClick={handleDeleteIssues} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex' }} title="ลบ"><Trash2 size={13} /></button>
                                        </div>
                                    </div>
                                    {job.currentIssues}
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input id="issue-input" className="input" placeholder="ระบุปัญหาที่พบ (ถ้ามี)..." value={localIssues} onChange={e => setLocalIssues(e.target.value)} style={{ flex: 1 }} />
                            <button className="btn btn-secondary btn-sm" onClick={handleUpdateIssues}>อัปเดตปัญหา</button>
                        </div>
                        {issueSuccess && (
                            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontSize: '12px', fontWeight: 600 }}>
                                <CheckCircle2 size={14} /> อัปเดตปัญหาสำเร็จ!
                            </div>
                        )}
                    </div>

                    {job.status === 'ต้องแก้ไข' && (
                        <div className="detail-section" style={{ borderLeft: '4px solid #ef4444', paddingLeft: '16px' }}>
                            <h4 style={{ color: '#ef4444' }}>สาเหตุที่ต้องแก้ไข</h4>
                            <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '6px', border: '1px solid #fee2e2', fontSize: '13px', color: '#991b1b', whiteSpace: 'pre-wrap' }}>
                                {job.fixReason || <em style={{ color: '#f87171' }}>ไม่ได้ระบุสาเหตุ</em>}
                            </div>
                        </div>
                    )}

                    <div className="detail-section">
                        <h4>หมายเหตุ</h4>
                        <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-primary)', fontSize: '13px', minHeight: '40px', whiteSpace: 'pre-wrap' }}>
                            {job.notes || <em style={{ color: 'var(--text-tertiary)' }}>ไม่มีหมายเหตุ</em>}
                        </div>
                    </div>

                    <div className="detail-section">
                        <h4>ทีมงานและภารกิจประจำวัน</h4>
                        <div className="log-list" style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {job.dailyTasks && job.dailyTasks.length > 0 ? job.dailyTasks.map((dt, idx) => (
                                <div key={idx} style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-primary)', fontSize: '13px' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--brand-primary)' }}>📅 {formatDate(dt.date)}</div>
                                    <div style={{ marginBottom: '4px' }}><strong>ภารกิจ:</strong> {dt.task || <em style={{ color: 'var(--text-tertiary)' }}>ไม่ระบุภารกิจ</em>}</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        <strong>ทีม:</strong> {dt.staffNames.length > 0 ? dt.staffNames.join(', ') : 'ยังไม่ระบุ'}
                                    </div>
                                </div>
                            )) : <small style={{ color: 'var(--text-tertiary)' }}>ยังไม่มีการมอบหมายงานรายวัน</small>}
                        </div>
                    </div>

                    <div className="detail-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <h4>ทีมงานประจำโปรเจกต์ ({(job.assignedStaffIds || []).length})</h4>
                            <button className="btn btn-sm btn-outline" onClick={() => setIsAdding(!isAdding)}>{isAdding ? 'ยกเลิก' : '+ เพิ่ม'}</button>
                        </div>
                        {isAdding && (
                            <select className="select" onChange={e => handleAddMember(e.target.value)} defaultValue="" style={{ marginBottom: '8px' }}>
                                <option value="" disabled>เลือกพนักงาน</option>
                                {staff.filter(s => !(job.assignedStaffIds || []).includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.nickname}</option>)}
                            </select>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {(job.assignedStaffIds || []).map(id => (
                                <span key={id} className="staff-chip">
                                    {staff.find(s => s.id === id)?.nickname || 'ช่าง'}
                                    <button onClick={() => handleRemoveMember(id)} style={{ border: 'none', background: 'transparent', color: '#ef4444', marginLeft: '4px', cursor: 'pointer' }}>✕</button>
                                </span>
                            ))}
                            {(job.assignedStaffIds || []).length === 0 && <small style={{ color: 'var(--text-tertiary)' }}>ไม่มีทีมงานที่ได้รับมอบหมาย</small>}
                        </div>
                    </div>

                    <div className="detail-section">
                        <h4>ไฟล์ประกอบ / ลิ้งค์งาน</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {(job.attachments || []).map(at => (
                                <a key={at.id} href={at.url} target="_blank" rel="noreferrer" className="staff-chip" style={{ textDecoration: 'none', color: 'inherit', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {at.type === 'link' ? <Link size={12} /> : <FileText size={12} />} {at.name}
                                </a>
                            ))}
                            {(job.attachments || []).length === 0 && <small style={{ color: 'var(--text-tertiary)' }}>ไม่มีไฟล์แนบ</small>}
                        </div>
                    </div>

                    <div className="detail-section">
                        <h4>บันทึกความคืบหน้า (โดย: {user?.user_metadata?.nickname || user?.email?.split('@')[0]})</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                            {staff.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setLogStaffIds(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                                    style={{
                                        border: 'none',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        fontSize: '11px',
                                        background: logStaffIds.includes(s.id) ? 'var(--brand-primary)' : 'var(--bg-tertiary)',
                                        color: logStaffIds.includes(s.id) ? '#fff' : 'inherit',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {s.nickname}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <textarea className="input" placeholder="พิมพ์บันทึก..." value={newLog} onChange={e => setNewLog(e.target.value)} style={{ flex: 1, minHeight: '60px' }} />
                            <button className="btn btn-primary" onClick={handleAddLog}>บันทึก</button>
                        </div>
                        <div className="log-list" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                            {(job.progressLogs || []).map(log => (
                                <div key={log.id} style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                        <span>{formatDate(log.date)} • โดย: {log.author}</span>
                                        <button onClick={() => handleDeleteLog(log.id)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>ลบ</button>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '13px' }}>{log.text}</p>
                                    {log.workerIds?.length > 0 && (
                                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                            {log.workerIds.map(sid => (
                                                <span key={sid} style={{ fontSize: '10px', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>
                                                    {staff.find(s => s.id === sid)?.nickname}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>ปิดหน้าต่าง</button>
                </div>
            </div>
        </div>
    );
}
