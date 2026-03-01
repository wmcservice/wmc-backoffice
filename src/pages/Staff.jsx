import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Edit3, Trash2, User, Clock, Briefcase, Eye, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Upload, Download } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getStaff, saveStaffMember, deleteStaffMember, getAllocationsByStaff, getJobs } from '../data/store';
import { createStaff, STAFF_ROLES, STAFF_SKILLS } from '../data/models';
import { calculateOvertime, calculateDailyPay } from '../utils/overtime';
import { statusToKey, getRoleColor } from '../utils/helpers';
import { read, utils, writeFile } from 'xlsx';
import './Staff.css';

export default function Staff() {
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('ทุกตำแหน่ง');
    const [showModal, setShowModal] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [jobs, setJobs] = useState([]);
    
    // Sorting state
    const [sortConfig, setSortOrder] = useState({ key: 'id', direction: 'asc' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Staff
            const { data: staffData, error: staffError } = await supabase
                .from('staff')
                .select('*');
            
            if (staffError) throw staffError;

            // Map database snake_case to camelCase
            const formattedStaff = (staffData || []).map(s => ({
                id: s.id,
                fingerprintId: s.fingerprint_id,
                fullName: s.full_name,
                nickname: s.nickname,
                role: s.role,
                primarySkill: s.primary_skill,
                isActive: s.is_active,
                phone: s.phone,
                additionalInfo: s.additional_info,
                createdAt: s.created_at
            }));

            setStaffList(formattedStaff);

            // Fetch Jobs
            setJobs(getJobs());
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('ไม่สามารถดึงข้อมูลพนักงานได้');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortOrder({ key, direction });
    };

    const filtered = useMemo(() => {
        let result = staffList.filter(s => {
            const matchSearch = !search ||
                (s.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
                (s.nickname || '').toLowerCase().includes(search.toLowerCase()) ||
                (s.fingerprintId || '').toLowerCase().includes(search.toLowerCase()) ||
                (s.id || '').toLowerCase().includes(search.toLowerCase());
            const matchRole = roleFilter === 'ทุกตำแหน่ง' || s.role === roleFilter;
            return matchSearch && matchRole;
        });

        // Apply Sorting
        if (sortConfig.key) {
            result.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];

                // Handle special cases for IDs (like WMC-004)
                if (sortConfig.key === 'id' || sortConfig.key === 'fingerprintId') {
                    valA = valA || a.id || '';
                    valB = valB || b.id || '';
                }

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [staffList, search, roleFilter, sortConfig]);

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} style={{ marginLeft: '4px', opacity: 0.3 }} />;
        return sortConfig.direction === 'asc' ? 
            <ArrowUp size={14} style={{ marginLeft: '4px', color: 'var(--brand-primary)' }} /> : 
            <ArrowDown size={14} style={{ marginLeft: '4px', color: 'var(--brand-primary)' }} />;
    };

    const handleSave = async (member) => {
        try {
            const dbData = {
                fingerprint_id: member.fingerprintId,
                full_name: member.fullName,
                nickname: member.nickname,
                role: member.role,
                primary_skill: member.primarySkill,
                is_active: member.isActive,
                phone: member.phone,
                additional_info: member.additionalInfo
            };

            if (editingStaff) {
                // Update
                const { error } = await supabase
                    .from('staff')
                    .update(dbData)
                    .eq('id', member.id);
                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabase
                    .from('staff')
                    .insert([dbData]);
                if (error) throw error;
            }

            fetchData();
            setShowModal(false);
            setEditingStaff(null);
        } catch (error) {
            console.error('Error saving staff:', error);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    };

    const handleDelete = async (id) => {
        if (confirm('ยืนยันการลบพนักงานคนนี้?')) {
            try {
                const { error } = await supabase
                    .from('staff')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
                fetchData();
            } catch (error) {
                console.error('Error deleting staff:', error);
                alert('ไม่สามารถลบข้อมูลได้');
            }
        }
    };

    const handleImportStaff = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setLoading(true);
            const data = await file.arrayBuffer();
            const workbook = read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = utils.sheet_to_json(worksheet);

            const newStaff = jsonData.map(row => ({
                fingerprint_id: String(row['รหัสพนักงาน'] || row.fingerprintId || ''),
                nickname: String(row['ชื่อเล่น'] || row.nickname || ''),
                full_name: row['ชื่อ-นามสกุล'] || row.fullName || '',
                role: row['ตำแหน่ง'] || row.role || 'พนักงาน',
                primary_skill: row['ทักษะหลัก'] || row.primarySkill || 'ติดตั้ง',
                phone: String(row['เบอร์โทร'] || row.phone || ''),
                is_active: true
            })).filter(s => s.nickname);

            if (newStaff.length === 0) {
                alert('ไม่พบข้อมูลพนักงานที่ถูกต้อง');
                setLoading(false);
                return;
            }

            if (confirm(`พบข้อมูลพนักงาน ${newStaff.length} คน ต้องการนำเข้าข้อมูลใช่หรือไม่?`)) {
                const { error } = await supabase.from('staff').insert(newStaff);
                if (error) throw error;
                alert('นำเข้าข้อมูลพนักงานเรียบร้อยแล้ว!');
                fetchData();
            }
        } catch (error) {
            console.error('Import error:', error);
            alert('เกิดข้อผิดพลาดในการนำเข้าไฟล์');
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    const handleDownloadTemplate = () => {
        const templateData = [
            {
                'รหัสพนักงาน': 'WMC-001',
                'ชื่อเล่น': 'ตัวอย่าง',
                'ชื่อ-นามสกุล': 'นายทดสอบ ระบบ',
                'ตำแหน่ง': 'พนักงาน',
                'ทักษะหลัก': 'ติดตั้ง',
                'เบอร์โทร': '0812345678'
            }
        ];
        const worksheet = utils.sheet_to_json(templateData); // Fix: this should be json_to_sheet
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, utils.json_to_sheet(templateData), 'Template');
        writeFile(workbook, 'wmc-staff-template.xlsx');
    };

    const getStaffStats = (staffId) => {
        const staffJobs = jobs.filter(j => j.assignedStaffIds?.includes(staffId));
        return { jobCount: staffJobs.length };
    };

    if (loading && staffList.length === 0) {
        return (
            <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader2 className="animate-spin" size={48} />
            </div>
        );
    }

    return (
        <div className="page-content">
            <div className="page-header">
                <div>
                    <h1>รายชื่อพนักงาน</h1>
                    <p className="subtitle">มีพนักงานทั้งหมด {staffList.length} คน • กำลังปฏิบัติงาน {staffList.filter(s => s.isActive).length} คน</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
                        <Download size={16} /> Template
                    </button>
                    <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                        <Upload size={16} /> Import Excel
                        <input type="file" accept=".xlsx, .xls" onChange={handleImportStaff} style={{ display: 'none' }} />
                    </label>
                    <button className="btn btn-primary" onClick={() => { setEditingStaff(null); setShowModal(true); }}>
                        <Plus size={16} /> เพิ่มพนักงาน
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="filters-bar">
                <div className="search-input">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="ค้นหาตามชื่อ, ชื่อเล่น, รหัสพนักงาน..."
                        className="input"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select className="select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                    <option value="ทุกตำแหน่ง">ทุกตำแหน่ง</option>
                    {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>

            {/* Staff Data Table */}
            <div className="card">
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('id')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>รหัสพนักงาน <SortIcon columnKey="id" /></div>
                                </th>
                                <th onClick={() => handleSort('nickname')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>ชื่อเล่น <SortIcon columnKey="nickname" /></div>
                                </th>
                                <th onClick={() => handleSort('fullName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>ชื่อ-นามสกุล <SortIcon columnKey="fullName" /></div>
                                </th>
                                <th onClick={() => handleSort('role')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>ตำแหน่ง <SortIcon columnKey="role" /></div>
                                </th>
                                <th>จำนวนงาน</th>
                                <th onClick={() => handleSort('isActive')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>สถานะ <SortIcon columnKey="isActive" /></div>
                                </th>
                                <th style={{ textAlign: 'right' }}>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(member => {
                                const stats = getStaffStats(member.id);
                                return (
                                    <tr
                                        key={member.id}
                                        className={selectedStaff?.id === member.id ? 'active-row' : ''}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => setSelectedStaff(member)}
                                    >
                                        <td style={{ fontWeight: 600 }}>{member.fingerprintId || member.id}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div className="staff-table-avatar" style={{ background: 'var(--bg-tertiary)' }}>
                                                    {member.nickname.charAt(0)}
                                                </div>
                                                <strong>{member.nickname}</strong>
                                            </div>
                                        </td>
                                        <td>{member.fullName}</td>
                                        <td><span className="badge" style={{ fontSize: '11px', backgroundColor: getRoleColor(member.role), color: '#fff' }}>{member.role}</span></td>
                                        <td>{stats.jobCount}</td>
                                        <td>
                                            <span className={`badge ${member.isActive ? 'badge-completed' : 'badge-queue'}`}>
                                                {member.isActive ? 'ปกติ' : 'พ้นสภาพ'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="staff-card-actions" style={{ justifyContent: 'flex-end' }}>
                                                <button className="btn btn-ghost btn-icon btn-sm" onClick={e => { e.stopPropagation(); setSelectedStaff(member); }} title="View Details">
                                                    <Eye size={16} />
                                                </button>
                                                <button className="btn btn-ghost btn-icon btn-sm" onClick={e => { e.stopPropagation(); setEditingStaff(member); setShowModal(true); }} title="Edit">
                                                    <Edit3 size={16} />
                                                </button>
                                                <button className="btn btn-ghost btn-icon btn-sm" onClick={e => { e.stopPropagation(); handleDelete(member.id); }} title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Staff Detail Modal */}
            {selectedStaff && (
                <StaffDetailModal
                    staffMember={selectedStaff}
                    jobs={jobs}
                    onClose={() => setSelectedStaff(null)}
                />
            )}

            {/* Staff Modal */}
            {showModal && (
                <StaffModal
                    staff={editingStaff}
                    onSave={handleSave}
                    onClose={() => { setShowModal(false); setEditingStaff(null); }}
                />
            )}
        </div>
    );
}

function StaffDetailModal({ staffMember, jobs, onClose }) {
    const staffJobs = useMemo(() => {
        return jobs.filter(j => j.assignedStaffIds?.includes(staffMember.id));
    }, [staffMember.id, jobs]);

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal" style={{ maxWidth: '800px' }}>
                <div className="modal-header">
                    <div>
                        <h2>{staffMember.nickname} ({staffMember.fullName})</h2>
                        <p className="subtitle">ประวัติการได้รับมอบหมายงาน</p>
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    {/* Summary Stats */}
                    <div className="ot-summary" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(2, 1fr)' }}>
                        <div className="ot-sum-item">
                            <span>งานทั้งหมด</span>
                            <strong>{staffJobs.length} โปรเจกต์</strong>
                        </div>
                        <div className="ot-sum-item">
                            <span>ตำแหน่ง</span>
                            <strong style={{ color: getRoleColor(staffMember.role) }}>{staffMember.role}</strong>
                        </div>
                    </div>

                    {/* Additional Info Section */}
                    {staffMember.additionalInfo && (
                        <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
                            <h4 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>ข้อมูลเพิ่มเติม / รายละเอียดติดต่อ</h4>
                            <p style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{staffMember.additionalInfo}</p>
                        </div>
                    )}

                    {/* Job List */}
                    <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>โปรเจกต์ที่รับผิดชอบ</h4>
                    {staffJobs.length > 0 ? (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>เลขที่ QT</th>
                                        <th>ชื่อโปรเจกต์</th>
                                        <th>ลูกค้า</th>
                                        <th>ระยะเวลา</th>
                                        <th>สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffJobs.map(j => (
                                        <tr key={j.id}>
                                            <td style={{ fontWeight: 600 }}>{j.qtNumber || '-'}</td>
                                            <td>{j.projectName}</td>
                                            <td>{j.clientName}</td>
                                            <td style={{ fontSize: '12px' }}>{j.startDate} → {j.endDate}</td>
                                            <td>
                                                <span className={`badge badge-${statusToKey(j.status)}`}>
                                                    {j.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                            <p style={{ color: 'var(--text-tertiary)' }}>ไม่มีประวัติการรับงาน</p>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>ปิดหน้าต่าง</button>
                </div>
            </div>
        </div>
    );
}

function StaffModal({ staff, onSave, onClose }) {
    const [form, setForm] = useState(staff || createStaff());
    const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <h2>{staff ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงาน'}</h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <div className="form-grid">
                        <div className="input-group">
                            <label>ชื่อ-นามสกุล</label>
                            <input className="input" value={form.fullName} onChange={e => update('fullName', e.target.value)} />
                        </div>
                        <div className="input-group">
                            <label>ชื่อเล่น</label>
                            <input className="input" value={form.nickname} onChange={e => update('nickname', e.target.value)} />
                        </div>
                        <div className="input-group">
                            <label>รหัสพนักงาน</label>
                            <input className="input" value={form.fingerprintId} onChange={e => update('fingerprintId', e.target.value)} />
                        </div>
                        <div className="input-group">
                            <label>เบอร์โทรศัพท์</label>
                            <input className="input" value={form.phone} onChange={e => update('phone', e.target.value)} />
                        </div>
                        <div className="input-group">
                            <label>ตำแหน่ง</label>
                            <select className="select" value={form.role} onChange={e => update('role', e.target.value)}>
                                {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div className="input-group">
                            <label>ทักษะหลัก</label>
                            <select className="select" value={form.primarySkill} onChange={e => update('primarySkill', e.target.value)}>
                                {STAFF_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="input-group">
                            <label>สถานะ</label>
                            <select className="select" value={form.isActive ? 'true' : 'false'} onChange={e => update('isActive', e.target.value === 'true')}>
                                <option value="true">ปฏิบัติงานอยู่</option>
                                <option value="false">ลาออก/พักงาน</option>
                            </select>
                        </div>
                        <div className="input-group full-width">
                            <label>ข้อมูลเพิ่มเติม (ที่อยู่, บัญชีธนาคาร, ฯลฯ)</label>
                            <textarea
                                className="textarea"
                                value={form.additionalInfo}
                                onChange={e => setForm({ ...form, additionalInfo: e.target.value })}
                                placeholder="ระบุรายละเอียดเพิ่มเติม..."
                            />
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
                    <button className="btn btn-primary" onClick={() => onSave(form)}>
                        {staff ? 'บันทึกการแก้ไข' : 'เพิ่มพนักงาน'}
                    </button>
                </div>
            </div>
        </div>
    );
}
