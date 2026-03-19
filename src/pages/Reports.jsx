import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { FileText, Printer, Filter, Calendar as CalendarIcon, Loader2, AlertCircle } from 'lucide-react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { formatDateShort, getStatusColor, statusToKey, jobTypeToKey } from '../utils/helpers';
import './Reports.css';

export default function Reports({ user }) {
    const [jobs, setJobs] = useState([]);
    const [allocations, setAllocations] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [timeframe, setTimeframe] = useState('today'); // 'today', 'week', 'month', 'custom'
    const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedProject, setSelectedProject] = useState('all');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch active staff
            const { data: sData } = await supabase.from('staff').select('*').eq('is_active', true);
            setStaff(sData || []);
            const staffMap = {};
            (sData || []).forEach(s => staffMap[s.id] = s.nickname);

            // 2. Fetch all allocations
            const { data: aData } = await supabase.from('allocations').select('*');
            setAllocations(aData || []);

            // 3. Fetch all jobs with relations
            const { data: jData } = await supabase.from('jobs')
                .select('*, sub_tasks (*), progress_logs (*, log_staff_assignments(staff_id))')
                .order('start_date', { ascending: true });

            if (jData) {
                setJobs(jData.map(j => {
                    const jobAllocs = (aData || []).filter(a => a.job_id === j.id);
                    const uniqueStaffIds = [...new Set(jobAllocs.map(a => a.staff_id))];
                    const activeWorkers = uniqueStaffIds.map(id => staffMap[id]).filter(Boolean);

                    return {
                        ...j,
                        qtNumber: j.qt_number, 
                        projectName: j.project_name, 
                        clientName: j.client_name,
                        jobType: j.job_type, 
                        startDate: j.start_date, 
                        endDate: j.end_date,
                        priority: j.priority, 
                        notes: j.notes, 
                        fixReason: j.fix_reason,
                        overallProgress: j.overall_progress, 
                        defaultCheckIn: j.default_check_in, 
                        defaultCheckOut: j.default_check_out,
                        subTasks: (j.sub_tasks || []).map(st => ({ id: st.id, title: st.title, isCompleted: st.is_completed })),
                        progressLogs: (j.progress_logs || []).map(pl => ({
                            id: pl.id, date: pl.log_date, text: pl.text, author: pl.author,
                        })).sort((a, b) => new Date(b.date) - new Date(a.date)),
                        activeWorkers
                    };
                }));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Derived Data
    const uniqueProjects = useMemo(() => {
        return [...new Set(jobs.map(j => j.projectName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
    }, [jobs]);

    const filteredJobs = useMemo(() => {
        let result = [...jobs];

        // 1. Filter by Project
        if (selectedProject !== 'all') {
            result = result.filter(j => j.projectName === selectedProject);
        }

        // 2. Filter by Timeframe (jobs active within the period)
        const today = new Date();
        let periodStart, periodEnd;

        if (timeframe === 'today') {
            periodStart = startOfDay(today);
            periodEnd = endOfDay(today);
        } else if (timeframe === 'week') {
            periodStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
            periodEnd = endOfWeek(today, { weekStartsOn: 1 });
        } else if (timeframe === 'month') {
            periodStart = startOfMonth(today);
            periodEnd = endOfMonth(today);
        } else if (timeframe === 'custom') {
            periodStart = startOfDay(parseISO(customStartDate));
            periodEnd = endOfDay(parseISO(customEndDate));
        }

        if (periodStart && periodEnd) {
            result = result.filter(j => {
                if (!j.startDate || !j.endDate) return false;
                const jStart = startOfDay(parseISO(j.startDate));
                const jEnd = endOfDay(parseISO(j.endDate));
                // Check for generic overlap between two periods
                return jStart <= periodEnd && jEnd >= periodStart;
            });
        }

        return result;
    }, [jobs, selectedProject, timeframe, customStartDate, customEndDate]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return <div className="loading-container"><Loader2 className="animate-spin" /> กำลังโหลดข้อมูลรายงาน...</div>;
    }

    return (
        <div className="page-content reports-page">
            {/* --- No-print controls --- */}
            <div className="no-print">
                <div className="page-header">
                    <div>
                        <h1>รายงาน <small style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 'normal' }}>สรุปผลการปฏิบัติงาน</small></h1>
                        <p className="subtitle">ดูสรุปและพิมพ์รายงานสำหรับส่งมอบหรืองานส่วนหลัง</p>
                    </div>
                    <div className="header-actions">
                        <button className="btn btn-primary" onClick={handlePrint}>
                            <Printer size={16} /> พิมพ์รายงาน (A4)
                        </button>
                    </div>
                </div>

                <div className="card filters-card" style={{ marginBottom: '24px' }}>
                    <div className="card-body" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div className="input-group">
                            <label>ช่วงเวลา</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className={`btn ${timeframe === 'today' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTimeframe('today')}>วันนี้</button>
                                <button className={`btn ${timeframe === 'week' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTimeframe('week')}>สัปดาห์นี้</button>
                                <button className={`btn ${timeframe === 'month' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTimeframe('month')}>เดือนนี้</button>
                                <button className={`btn ${timeframe === 'custom' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTimeframe('custom')}>กำหนดเอง</button>
                            </div>
                        </div>

                        {timeframe === 'custom' && (
                            <>
                                <div className="input-group">
                                    <label>ตั้งแต่</label>
                                    <input type="date" className="input" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label>ถึง</label>
                                    <input type="date" className="input" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} />
                                </div>
                            </>
                        )}

                        <div className="input-group" style={{ minWidth: '250px', flex: 1 }}>
                            <label>โปรเจกต์</label>
                            <select className="select" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                                <option value="all">ทุกโปรเจกต์</option>
                                {uniqueProjects.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Printable A4 Area --- */}
            <div className="printable-a4">
                <div className="print-header">
                    <div className="print-logo-col">
                        <h2>WMC Operations</h2>
                        <p>รายงานสรุปการปฏิบัติงาน (Operation Summary Report)</p>
                    </div>
                    <div className="print-meta-col">
                        <div className="meta-row">
                            <span className="meta-label">วันที่พิมพ์:</span>
                            <span className="meta-value">{formatDateShort(new Date().toISOString())}</span>
                        </div>
                        <div className="meta-row">
                            <span className="meta-label">ช่วงเวลาข้อมูล:</span>
                            <span className="meta-value">
                                {timeframe === 'today' && 'วันนี้'}
                                {timeframe === 'week' && 'สัปดาห์นี้'}
                                {timeframe === 'month' && 'เดือนนี้'}
                                {timeframe === 'custom' && `${formatDateShort(customStartDate)} - ${formatDateShort(customEndDate)}`}
                            </span>
                        </div>
                        <div className="meta-row">
                            <span className="meta-label">โปรเจกต์:</span>
                            <span className="meta-value">{selectedProject === 'all' ? 'ทุกโปรเจกต์รวม' : selectedProject}</span>
                        </div>
                    </div>
                </div>

                <div className="print-summary-stats">
                    <div className="stat-box">
                        <span className="stat-num">{filteredJobs.length}</span>
                        <span className="stat-text">งานทั้งหมด</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-num">{filteredJobs.filter(j => j.status === 'เสร็จสมบูรณ์').length}</span>
                        <span className="stat-text">เสร็จสมบูรณ์</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-num">{filteredJobs.filter(j => j.status === 'กำลังดำเนินการ').length}</span>
                        <span className="stat-text">กำลังดำเนินการ</span>
                    </div>
                    <div className="stat-box" style={{ background: filteredJobs.filter(j => j.status === 'ต้องแก้ไข').length > 0 ? '#fef2f2' : '' }}>
                        <span className="stat-num" style={{ color: filteredJobs.filter(j => j.status === 'ต้องแก้ไข').length > 0 ? '#dc2626' : 'inherit' }}>
                            {filteredJobs.filter(j => j.status === 'ต้องแก้ไข').length}
                        </span>
                        <span className="stat-text">ต้องแก้ไข</span>
                    </div>
                </div>

                {filteredJobs.length === 0 ? (
                    <div className="print-empty">
                        <AlertCircle size={32} />
                        <p>ไม่พบข้อมูลงานในช่วงเวลาหรือโปรเจกต์ที่เลือก</p>
                    </div>
                ) : (
                    <div className="print-jobs-list">
                        {filteredJobs.map((job, idx) => (
                            <div key={job.id} className="print-job-block">
                                <div className="pj-header">
                                    <div className="pj-title-row">
                                        <h3>{idx + 1}. {job.projectName}</h3>
                                        <span className={`pj-status-badge status-${statusToKey(job.status)}`}>{job.status}</span>
                                    </div>
                                    <div className="pj-subtitle-row">
                                        <span><strong>QT:</strong> {job.qtNumber || '-'}</span>
                                        <span><strong>ลูกค้า:</strong> {job.clientName || '-'}</span>
                                        <span><strong>วันที่จัดทำ:</strong> {formatDateShort(job.startDate)} {job.endDate !== job.startDate ? `ถึง ${formatDateShort(job.endDate)}` : ''}</span>
                                        <span><strong>ประเภท:</strong> {job.jobType}</span>
                                    </div>
                                </div>
                                
                                <div className="pj-content">
                                    <div className="pj-col">
                                        <div className="pj-section">
                                            <h4>บุคลากรที่รับผิดชอบ</h4>
                                            {job.activeWorkers.length > 0 ? (
                                                <div className="pj-staff-list">
                                                    {job.activeWorkers.join(', ')}
                                                </div>
                                            ) : (
                                                <div className="pj-empty-text">ยังไม่ระบุพนักงาน</div>
                                            )}
                                        </div>
                                        <div className="pj-section">
                                            <h4>รายละเอียดงาน/หมายเหตุ</h4>
                                            <div className="pj-notes-text">{job.notes || '-'}</div>
                                        </div>
                                        {job.status === 'ต้องแก้ไข' && job.fixReason && (
                                            <div className="pj-section pj-danger">
                                                <h4>สาเหตุที่ต้องแก้ไข</h4>
                                                <div>{job.fixReason}</div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="pj-col">
                                        <div className="pj-section">
                                            <h4>ความสำเร็จงานย่อย ({job.subTasks.filter(st => st.isCompleted).length}/{job.subTasks.length})</h4>
                                            {job.subTasks.length > 0 ? (
                                                <ul className="pj-task-list">
                                                    {job.subTasks.map(st => (
                                                        <li key={st.id} className={st.isCompleted ? 'completed' : ''}>
                                                            <div className={`checkbox-mock ${st.isCompleted ? 'checked' : ''}`}></div>
                                                            {st.title}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="pj-empty-text">-</div>
                                            )}
                                        </div>
                                        
                                        {job.progressLogs.length > 0 && (
                                            <div className="pj-section">
                                                <h4>บันทึกรายงานประจำวัน</h4>
                                                <ul className="pj-log-list">
                                                    {job.progressLogs.slice(0, 3).map(pl => (
                                                        <li key={pl.id}>
                                                            <div className="log-date">{formatDateShort(pl.date)}</div>
                                                            <div className="log-text">{pl.text}</div>
                                                        </li>
                                                    ))}
                                                    {job.progressLogs.length > 3 && <li className="log-more">...และอีก {job.progressLogs.length - 3} รายการ</li>}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
        </div>
    );
}
