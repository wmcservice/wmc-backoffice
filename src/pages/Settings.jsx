import { useState } from 'react';
import { Save, RotateCcw, Download, Upload, Plus, Trash2, Calendar } from 'lucide-react';
import { getParameters, saveParameters, getHolidays, saveHoliday, deleteHoliday, exportAllData, importAllData, resetAllData } from '../data/store';
import { createHoliday } from '../data/models';
import './Settings.css';

export default function Settings() {
    const [params, setParams] = useState(getParameters());
    const [holidays, setHolidays] = useState(getHolidays());
    const [saved, setSaved] = useState(false);
    const [newHoliday, setNewHoliday] = useState({ date: '', name: '', type: 'Public' });

    const updateParam = (field, value) => {
        setParams(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveParams = () => {
        saveParameters(params);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleAddHoliday = () => {
        if (!newHoliday.date || !newHoliday.name) return;
        const holiday = createHoliday(newHoliday);
        saveHoliday(holiday);
        setHolidays(getHolidays());
        setNewHoliday({ date: '', name: '', type: 'Public' });
    };

    const handleDeleteHoliday = (id) => {
        deleteHoliday(id);
        setHolidays(getHolidays());
    };

    const handleExport = () => {
        const data = exportAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wmc-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                importAllData(data);
                setParams(getParameters());
                setHolidays(getHolidays());
                alert('นำเข้าข้อมูลสำเร็จแล้ว!');
            } catch {
                alert('ไฟล์ JSON ไม่ถูกต้อง');
            }
        };
        reader.readAsText(file);
    };

    const handleReset = () => {
        if (confirm('รีเซ็ตข้อมูลทั้งหมดเป็นค่าเริ่มต้นใช่หรือไม่? การดำเนินการนี้ไม่สามารถยกเลิกได้')) {
            resetAllData();
            setParams(getParameters());
            setHolidays(getHolidays());
        }
    };

    return (
        <div className="page-content">
            <div className="page-header">
                <div>
                    <h1>ตั้งค่า</h1>
                    <p className="subtitle">จัดการพารามิเตอร์ระบบ, ปฏิทินวันหยุด และข้อมูล</p>
                </div>
            </div>

            <div className="settings-grid">
                {/* Work Parameters */}
                <div className="card">
                    <div className="card-header">
                        <h3>กฎการทำงาน</h3>
                        {saved && <span className="save-indicator">✓ บันทึกสำเร็จ</span>}
                    </div>
                    <div className="card-body">
                        <div className="form-grid">
                            <div className="input-group">
                                <label>เวลาเริ่มงาน</label>
                                <input className="input" type="time" value={params.workStartTime || ''} onChange={e => updateParam('workStartTime', e.target.value)} />
                            </div>
                            <div className="input-group">
                                <label>เวลาเลิกงาน</label>
                                <input className="input" type="time" value={params.workEndTime || ''} onChange={e => updateParam('workEndTime', e.target.value)} />
                            </div>
                            <div className="input-group">
                                <label>เริ่มพักเที่ยง</label>
                                <input className="input" type="time" value={params.lunchBreakStart || ''} onChange={e => updateParam('lunchBreakStart', e.target.value)} />
                            </div>
                            <div className="input-group">
                                <label>ระยะเวลาพักเที่ยง (นาที)</label>
                                <input className="input" type="number" value={params.lunchBreakDuration || 0} onChange={e => updateParam('lunchBreakDuration', parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="input-group">
                                <label>เริ่มพักเย็นเมื่อทำเกินเวลา</label>
                                <input className="input" type="time" value={params.dinnerBreakThreshold || ''} onChange={e => updateParam('dinnerBreakThreshold', e.target.value)} />
                            </div>
                            <div className="input-group">
                                <label>ระยะเวลาพักเย็น (นาที)</label>
                                <input className="input" type="number" value={params.dinnerBreakDuration || 0} onChange={e => updateParam('dinnerBreakDuration', parseInt(e.target.value) || 0)} />
                            </div>
                        </div>

                        <h4 className="section-title">อัตราค่าล่วงเวลา (OT)</h4>
                        <div className="form-grid">
                            <div className="input-group">
                                <label>อัตรา OT 1.5×</label>
                                <input className="input" type="number" step="0.1" value={params.otRate1 || 0} onChange={e => updateParam('otRate1', parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="input-group">
                                <label>ชม. สูงสุดของ OT 1</label>
                                <input className="input" type="number" value={params.otRate1MaxHours || 0} onChange={e => updateParam('otRate1MaxHours', parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="input-group">
                                <label>อัตรา OT 2×</label>
                                <input className="input" type="number" step="0.1" value={params.otRate2 || 0} onChange={e => updateParam('otRate2', parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="input-group">
                                <label>อัตรา OT 3× (วันหยุด)</label>
                                <input className="input" type="number" step="0.1" value={params.otRate3 || 0} onChange={e => updateParam('otRate3', parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="input-group">
                                <label>ค่าแรงพื้นฐานรายวัน (฿)</label>
                                <input className="input" type="number" value={params.baseDailyRate || 0} onChange={e => updateParam('baseDailyRate', parseInt(e.target.value) || 0)} />
                            </div>
                        </div>

                        <div style={{ marginTop: 'var(--space-4)' }}>
                            <button className="btn btn-primary" onClick={handleSaveParams}>
                                <Save size={16} /> บันทึกระเบียบปฏิบัติ
                            </button>
                        </div>
                    </div>
                </div>

                {/* Holiday Calendar */}
                <div className="card">
                    <div className="card-header">
                        <h3><Calendar size={16} /> ปฏิทินวันหยุด</h3>
                        <span className="badge badge-queue">มีวันหยุด {holidays.length} วัน</span>
                    </div>
                    <div className="card-body">
                        {/* Add Holiday */}
                        <div className="holiday-add-row">
                            <input className="input" type="date" value={newHoliday.date} onChange={e => setNewHoliday(prev => ({ ...prev, date: e.target.value }))} />
                            <input className="input" placeholder="ชื่อวันหยุด" value={newHoliday.name} onChange={e => setNewHoliday(prev => ({ ...prev, name: e.target.value }))} />
                            <select className="select" value={newHoliday.type} onChange={e => setNewHoliday(prev => ({ ...prev, type: e.target.value }))}>
                                <option value="Public">วันหยุดราชการ</option>
                                <option value="Company">วันหยุดบริษัท</option>
                            </select>
                            <button className="btn btn-primary btn-sm" onClick={handleAddHoliday}>
                                <Plus size={14} /> เพิ่ม
                            </button>
                        </div>

                        {/* Holiday List */}
                        <div className="holiday-list">
                            {(holidays || []).sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(h => (
                                <div key={h.id} className="holiday-item">
                                    <div className="holiday-info">
                                        <span className="holiday-date">{h.date}</span>
                                        <span className="holiday-name">{h.name}</span>
                                        <span className={`badge ${h.type === 'Public' ? 'badge-in-progress' : 'badge-review'}`} style={{ fontSize: '9px', padding: '1px 6px' }}>
                                            {h.type}
                                        </span>
                                    </div>
                                    <button className="btn btn-ghost btn-icon" onClick={() => handleDeleteHoliday(h.id)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Management */}
            <div className="card" style={{ marginTop: 'var(--space-5)' }}>
                <div className="card-header">
                    <h3>Data Management</h3>
                </div>
                <div className="card-body">
                    <div className="data-actions">
                        <button className="btn btn-secondary" onClick={handleExport}>
                            <Download size={16} /> Export All Data (JSON)
                        </button>
                        <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                            <Upload size={16} /> Import Data
                            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
                        </label>
                        <button className="btn btn-danger" onClick={handleReset}>
                            <RotateCcw size={16} /> Reset All Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
