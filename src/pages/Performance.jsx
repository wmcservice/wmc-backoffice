import { useMemo, useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    Cell
} from 'recharts';
import { AlertTriangle, TrendingUp, Award, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getJobs, getStaff } from '../data/store';
import { JOB_TYPES } from '../data/models';
import { getRoleColor, getJobTypeColor } from '../utils/helpers';
import { StaffDetailModal } from './Staff';
import { JobDetailModal } from '../components/JobModals';
import './Performance.css';

export default function Performance() {
    const [allJobs, setAllJobs] = useState([]);
    const [allStaff, setAllStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [selectedJob, setSelectedJob] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: jobsData } = await supabase.from('jobs').select('*');
            const { data: staffData } = await supabase.from('staff').select('*');

            if (jobsData) {
                // Ensure assignedStaffIds is treated as array (it's stored in allocations, but some UI might expect it in job)
                // For performance page, let's also fetch allocations to be accurate
                const { data: allocData } = await supabase.from('allocations').select('job_id, staff_id');
                
                const formatted = jobsData.map(j => ({
                    ...j,
                    id: j.id,
                    qtNumber: j.qt_number,
                    projectName: j.project_name,
                    clientName: j.client_name,
                    startDate: j.start_date,
                    endDate: j.end_date,
                    jobType: j.job_type,
                    status: j.status,
                    overallProgress: j.overall_progress,
                    currentIssues: j.current_issues,
                    assignedStaffIds: allocData?.filter(a => a.job_id === j.id).map(a => a.staff_id) || []
                }));
                setAllJobs(formatted);
            }
            
            if (staffData) {
                setAllStaff(staffData.map(s => ({
                    id: s.id,
                    nickname: s.nickname,
                    fullName: s.full_name,
                    additionalInfo: s.additional_info,
                    role: s.role,
                    isActive: s.is_active
                })));
            }
        } catch (error) {
            console.error('Error fetching performance data:', error);
        } finally {
            setLoading(false);
        }
    };

    // 1. Calculate Category Performance
    const jobTypePerformance = useMemo(() => {
        if (!JOB_TYPES || allJobs.length === 0) return [];
        return JOB_TYPES.map(type => {
            const typeJobs = allJobs.filter(j => j && j.jobType === type);
            if (typeJobs.length === 0) return null;

            const total = typeJobs.length;
            const completed = typeJobs.filter(j => j.status === 'เสร็จสมบูรณ์' || (j.overallProgress >= 100)).length;
            const issues = typeJobs.filter(j => j.currentIssues && j.currentIssues.trim() !== '' && j.status !== 'เสร็จสมบูรณ์').length;
            const totalProgress = typeJobs.reduce((sum, j) => sum + (j.overallProgress || 0), 0);
            const avgProgress = Math.round(totalProgress / total);

            return { name: type, total, completed, issues, avgProgress, color: getJobTypeColor(type) };
        }).filter(Boolean).sort((a, b) => b.avgProgress - a.avgProgress);
    }, [allJobs]);

    // 2. Individual Performance Leaderboard
    const topPerformers = useMemo(() => {
        const activeStaff = allStaff.filter(s => s && s.isActive);
        return activeStaff.map(s => {
            const staffJobs = allJobs.filter(j => j && j.assignedStaffIds && j.assignedStaffIds.includes(s.id));
            const completed = staffJobs.filter(j => j.status === 'เสร็จสมบูรณ์' || (j.overallProgress >= 100)).length;
            const totalActiveProgress = staffJobs
                .filter(j => j.status !== 'เสร็จสมบูรณ์')
                .reduce((sum, j) => sum + (j.overallProgress || 0), 0);
            
            const activeCount = staffJobs.filter(j => j.status !== 'เสร็จสมบูรณ์').length;
            const avgActiveProgress = activeCount > 0 ? Math.round(totalActiveProgress / activeCount) : 0;

            return {
                id: s.id,
                nickname: s.nickname || 'Unknown',
                fullName: s.fullName,
                additionalInfo: s.additionalInfo,
                role: s.role,
                completed,
                score: completed * 100 + avgActiveProgress // Simple scoring for ranking
            };
        }).sort((a, b) => b.score - a.score).slice(0, 10);
    }, [allJobs, allStaff]);

    // 3. Overall Stats
    const stats = useMemo(() => {
        const completed = allJobs.filter(j => j.status === 'เสร็จสมบูรณ์' || (j.overallProgress >= 100)).length;
        const withIssues = allJobs.filter(j => j.currentIssues && j.currentIssues.trim() !== '' && j.status !== 'เสร็จสมบูรณ์').length;
        const inProgressJobs = allJobs.filter(j => j.status !== 'เสร็จสมบูรณ์');
        const avgProgress = inProgressJobs.length > 0 
            ? Math.round(inProgressJobs.reduce((sum, j) => sum + (j.overallProgress || 0), 0) / inProgressJobs.length)
            : 0;

        return { completed, withIssues, avgProgress, topName: topPerformers[0]?.nickname || '-' };
    }, [allJobs, topPerformers]);

    if (loading) {
        return (
            <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader2 className="animate-spin" size={48} />
            </div>
        );
    }

    if (allJobs.length === 0) {
        return (
            <div className="page-content">
                <div className="page-header">
                    <div>
                        <h1>ประสิทธิภาพและศักยภาพ</h1>
                        <p className="subtitle">วิเคราะห์ภาพรวมผลงานและการดันโปรเจกต์ให้เสร็จสิ้น</p>
                    </div>
                </div>
                <div className="card" style={{ padding: '60px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '16px', border: '2px dashed var(--border-primary)' }}>
                    <div style={{ marginBottom: '20px', color: 'var(--brand-primary)', opacity: 0.5 }}>
                        <Award size={64} />
                    </div>
                    <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>ยังไม่มีข้อมูลเพื่อประมวลผล</h3>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '16px', maxWidth: '400px', margin: '0 auto' }}>
                        เมื่อคุณเริ่มเพิ่ม "งาน" และมอบหมายพนักงานในระบบ Supabase ข้อมูลสถิติและประสิทธิภาพจะปรากฏที่นี่โดยอัตโนมัติ
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-content">
            <div className="page-header">
                <div>
                    <h1>ประสิทธิภาพและศักยภาพ</h1>
                    <p className="subtitle">วิเคราะห์ภาพรวมผลงานและการดันโปรเจกต์ให้เสร็จสิ้น</p>
                </div>
            </div>

            {/* KPI Row */}
            <div className="kpi-grid">
                <div className="kpi-card green">
                    <div className="kpi-icon green"><CheckCircle2 size={22} /></div>
                    <div className="kpi-info">
                        <div className="kpi-label">งานที่ส่งมอบแล้ว</div>
                        <div className="kpi-value">{stats.completed}</div>
                        <div className="kpi-sub">โครงการที่เสร็จ 100%</div>
                    </div>
                </div>
                <div className="kpi-card blue">
                    <div className="kpi-icon blue"><TrendingUp size={22} /></div>
                    <div className="kpi-info">
                        <div className="kpi-label">คืบหน้าเฉลี่ยรวม</div>
                        <div className="kpi-value">{stats.avgProgress}%</div>
                        <div className="kpi-sub">จากงานที่กำลังทำทั้งหมด</div>
                    </div>
                </div>
                <div className="kpi-card red">
                    <div className="kpi-icon red"><AlertTriangle size={22} /></div>
                    <div className="kpi-info">
                        <div className="kpi-label">จุดที่ต้องเร่งแก้ไข</div>
                        <div className="kpi-value">{stats.withIssues}</div>
                        <div className="kpi-sub">งานที่ระบุว่าติดปัญหา</div>
                    </div>
                </div>
                <div className="kpi-card yellow">
                    <div className="kpi-icon yellow"><Award size={22} /></div>
                    <div className="kpi-info">
                        <div className="kpi-label">ช่างยอดเยี่ยม</div>
                        <div className="kpi-value">{stats.topName}</div>
                        <div className="kpi-sub">ผลงานโดดเด่นที่สุด</div>
                    </div>
                </div>
            </div>

            <div className="perf-grid">
                {/* Chart: Progress by Category */}
                <div className="card">
                    <div className="card-header">
                        <h3>ความสำเร็จแยกตามประเภทงาน</h3>
                    </div>
                    <div className="card-body" style={{ height: '350px', padding: '20px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={jobTypePerformance} layout="vertical" margin={{ left: 30, right: 30 }}>
                                <XAxis type="number" domain={[0, 100]} hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12, fontWeight: 600 }} />
                                <Tooltip 
                                    cursor={{fill: 'var(--bg-tertiary)'}}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-lg)' }}
                                />
                                <Bar dataKey="avgProgress" name="ความคืบหน้าเฉลี่ย (%)" radius={[0, 4, 4, 0]} barSize={25}>
                                    {jobTypePerformance.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Leaderboard: Top Staff */}
                <div className="card">
                    <div className="card-header">
                        <h3>10 อันดับช่างผลงานสูงสุด</h3>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: '50px' }}>อันดับ</th>
                                        <th>ชื่อช่าง</th>
                                        <th>ตำแหน่ง</th>
                                        <th style={{ textAlign: 'center' }}>งานที่จบ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topPerformers.map((s, i) => (
                                        <tr key={s.id} onClick={() => setSelectedStaff(s)} style={{ cursor: 'pointer' }}>
                                            <td style={{ textAlign: 'center', fontWeight: 800, color: i < 3 ? 'var(--brand-primary)' : 'var(--text-tertiary)' }}>{i + 1}</td>
                                            <td><strong>{s.nickname}</strong></td>
                                            <td><span className="badge" style={{ backgroundColor: getRoleColor(s.role), color: '#fff', fontSize: '10px' }}>{s.role}</span></td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--status-completed)' }}>{s.completed}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Table: Deep Dive */}
            <div className="card" style={{ marginTop: 'var(--space-5)' }}>
                <div className="card-header">
                    <h3>วิเคราะห์ความสำเร็จแยกตามหมวดหมู่</h3>
                </div>
                <div className="card-body">
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>ประเภทงาน</th>
                                    <th>จำนวนงาน</th>
                                    <th>ความคืบหน้าเฉลี่ย</th>
                                    <th>ส่งมอบแล้ว</th>
                                    <th>ที่ยังติดปัญหา</th>
                                    <th>ประเมินสถานะ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobTypePerformance.map(t => (
                                    <tr key={t.name}>
                                        <td><strong>{t.name}</strong></td>
                                        <td>{t.total} งาน</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ minWidth: '35px', fontWeight: 700 }}>{t.avgProgress}%</span>
                                                <div style={{ flex: 1, height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', maxWidth: '150px' }}>
                                                    <div style={{ height: '100%', width: `${t.avgProgress}%`, background: t.color, borderRadius: '4px' }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--status-completed)', fontWeight: 700 }}>{t.completed}</td>
                                        <td style={{ color: t.issues > 0 ? 'var(--status-needs-fix)' : 'inherit', fontWeight: t.issues > 0 ? 700 : 400 }}>{t.issues}</td>
                                        <td>
                                            {t.avgProgress > 85 ? <span className="badge badge-completed">ยอดเยี่ยม</span> :
                                             t.issues > (t.total * 0.3) ? <span className="badge badge-needs-fix">วิกฤต</span> :
                                             <span className="badge badge-in-progress">ปกติ</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {/* Selected Staff Modal */}
            {selectedStaff && (
                <StaffDetailModal
                    staffMember={selectedStaff}
                    jobs={allJobs}
                    onClose={() => setSelectedStaff(null)}
                    onJobClick={(job) => setSelectedJob(job)}
                />
            )}

            {selectedJob && (
                <JobDetailModal
                    job={selectedJob}
                    staff={allStaff}
                    onClose={() => setSelectedJob(null)}
                    onUpdate={() => fetchData()}
                />
            )}
        </div>
    );
}
