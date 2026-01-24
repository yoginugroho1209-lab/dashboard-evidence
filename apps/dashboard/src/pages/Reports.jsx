import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ManageProjectsModal from '../components/ManageProjectsModal'

const Reports = () => {
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [evidenceList, setEvidenceList] = useState([]);
    const [standaloneEvidence, setStandaloneEvidence] = useState([]); // Evidence with EXIF but no matched point
    const [loading, setLoading] = useState(true);
    const [exportFormat, setExportFormat] = useState('kml');
    const [useExifCoords, setUseExifCoords] = useState(true); // Use EXIF coords for evidence in KML
    const [includeStandalone, setIncludeStandalone] = useState(true); // Include standalone evidence in export
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);

    const fetchProjects = async () => {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (data) {
            setProjects(data);
            // If current selected project is not in the list (e.g. was deleted), select the first one
            if (data.length > 0) {
                if (!selectedProjectId || !data.find(p => p.id === selectedProjectId)) {
                    setSelectedProjectId(data[0].id);
                }
            } else {
                setSelectedProjectId('');
            }
        }
        setLoading(false);
    };

    // Fetch projects on mount
    useEffect(() => {
        fetchProjects();
    }, []);

    // Fetch evidence and points when project changes
    useEffect(() => {
        if (!selectedProjectId) return;

        const fetchEvidence = async () => {
            // Fetch evidence with related point info
            const { data: evidenceData, error } = await supabase
                .from('evidence')
                .select(`
                    *,
                    points (
                        point_id,
                        name,
                        latitude,
                        longitude
                    )
                `)
                .eq('project_id', selectedProjectId)
                .order('created_at', { ascending: false });

            if (evidenceData) {
                setEvidenceList(evidenceData);
            }
        };

        // Also fetch points without evidence for this project
        const fetchAllData = async () => {
            const { data: pointsData } = await supabase
                .from('points')
                .select('*')
                .eq('project_id', selectedProjectId);

            const { data: evidenceData } = await supabase
                .from('evidence')
                .select('*')
                .eq('project_id', selectedProjectId)
                .order('created_at', { ascending: false });

            // Fetch standalone evidence (has EXIF coords but no matched point)
            const { data: standaloneData } = await supabase
                .from('evidence')
                .select('*')
                .is('point_id', null)
                .not('exif_latitude', 'is', null)
                .not('exif_longitude', 'is', null)
                .order('created_at', { ascending: false });

            // Combine points with their evidence
            if (pointsData && evidenceData) {
                const pointsWithEvidence = pointsData.map(point => {
                    const matchedEvidence = evidenceData.filter(e => e.point_id === point.id);
                    return {
                        ...point,
                        evidence: matchedEvidence
                    };
                });
                setEvidenceList(pointsWithEvidence);
            } else if (evidenceData) {
                setEvidenceList(evidenceData);
            }

            // Set standalone evidence
            if (standaloneData) {
                setStandaloneEvidence(standaloneData);
            }
        };

        fetchAllData();
    }, [selectedProjectId]);

    // Generate KML file for download
    const generateKML = () => {
        const selectedProject = projects.find(p => p.id === selectedProjectId);
        const projectName = selectedProject?.name || 'Evidence Report';

        let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
    <name>${projectName} - Evidence Report</name>
    <description>Generated on ${new Date().toLocaleString()}</description>
    
    <!-- Infrastructure Type Styles -->
    <Style id="ODC">
        <IconStyle>
            <color>ff0000ff</color>
            <scale>1.2</scale>
            <Icon>
                <href>http://maps.google.com/mapfiles/kml/shapes/triangle.png</href>
            </Icon>
        </IconStyle>
        <LabelStyle>
            <color>ff0000ff</color>
        </LabelStyle>
    </Style>
    
    <Style id="ODP">
        <IconStyle>
            <color>ffff7800</color>
            <scale>1.1</scale>
            <Icon>
                <href>http://maps.google.com/mapfiles/kml/shapes/square.png</href>
            </Icon>
        </IconStyle>
        <LabelStyle>
            <color>ffff7800</color>
        </LabelStyle>
    </Style>
    
    <Style id="Tiang">
        <IconStyle>
            <color>ff00ffff</color>
            <scale>1.1</scale>
            <Icon>
                <href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>
            </Icon>
        </IconStyle>
        <LabelStyle>
            <color>ff00ffff</color>
        </LabelStyle>
    </Style>
    
    <Style id="Kabel">
        <IconStyle>
            <color>ff00ff00</color>
            <scale>1.0</scale>
            <Icon>
                <href>http://maps.google.com/mapfiles/kml/shapes/road_shield3.png</href>
            </Icon>
        </IconStyle>
        <LabelStyle>
            <color>ff00ff00</color>
        </LabelStyle>
    </Style>
    
    <Style id="Closure">
        <IconStyle>
            <color>ffff00ff</color>
            <scale>1.1</scale>
            <Icon>
                <href>http://maps.google.com/mapfiles/kml/shapes/donut.png</href>
            </Icon>
        </IconStyle>
        <LabelStyle>
            <color>ffff00ff</color>
        </LabelStyle>
    </Style>
    
    <Style id="evidencePoint">
        <IconStyle>
            <color>ff00ff00</color>
            <scale>1.2</scale>
            <Icon>
                <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
            </Icon>
        </IconStyle>
    </Style>
    
    <Style id="pendingPoint">
        <IconStyle>
            <color>ff00a5ff</color>
            <scale>1.0</scale>
            <Icon>
                <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
            </Icon>
        </IconStyle>
    </Style>
    
    <Style id="exifPoint">
        <IconStyle>
            <color>ffff5500</color>
            <scale>1.1</scale>
            <Icon>
                <href>http://maps.google.com/mapfiles/kml/shapes/camera.png</href>
            </Icon>
        </IconStyle>
    </Style>
`;

        // Organize points by category and infrastructure type
        const organized = {
            'Existing': { 'ODC': [], 'ODP': [], 'Tiang': [], 'Kabel': [], 'Closure': [], 'Other': [] },
            'Plan': { 'ODC': [], 'ODP': [], 'Tiang': [], 'Kabel': [], 'Closure': [], 'Other': [] },
            'Uncategorized': []
        };

        // Process all evidence items
        const allItems = [...evidenceList];
        if (includeStandalone) {
            standaloneEvidence.forEach((item, idx) => {
                allItems.push({
                    ...item,
                    point_id: `Photo-${idx + 1}`,
                    name: `Photo Evidence ${idx + 1}`,
                    latitude: item.exif_latitude,
                    longitude: item.exif_longitude,
                    isStandalone: true
                });
            });
        }

        allItems.forEach((item, idx) => {
            const hasEvidence = item.evidence?.length > 0 || item.photo_url;
            const photoUrl = item.photo_url || item.evidence?.[0]?.photo_url || '';
            const name = item.point_id || item.name || `Point ${idx + 1}`;

            // Get infrastructure type from evidence
            const evidenceItem = item.evidence?.[0] || item;
            const infraType = evidenceItem.infrastructure_type || item.infrastructure_type || '';
            const category = evidenceItem.category || item.category || '';

            // Determine coordinates
            let lat, lng, coordSource;
            if (useExifCoords && hasEvidence) {
                const exifLat = evidenceItem.exif_latitude;
                const exifLng = evidenceItem.exif_longitude;
                if (exifLat && exifLng) {
                    lat = exifLat;
                    lng = exifLng;
                    coordSource = 'EXIF Photo';
                } else {
                    lat = item.latitude;
                    lng = item.longitude;
                    coordSource = 'KML Point';
                }
            } else {
                lat = item.latitude || item.exif_latitude;
                lng = item.longitude || item.exif_longitude;
                coordSource = item.latitude ? 'KML Point' : 'EXIF Photo';
            }

            if (!lat || !lng) return;

            // Determine style
            let styleId = hasEvidence ? 'evidencePoint' : 'pendingPoint';
            if (hasEvidence && infraType && ['ODC', 'ODP', 'Tiang', 'Kabel', 'Closure'].includes(infraType)) {
                styleId = infraType;
            }

            const pointData = {
                name,
                lat,
                lng,
                coordSource,
                hasEvidence,
                photoUrl,
                infraType,
                category,
                styleId,
                timestamp: item.exif_timestamp ? new Date(item.exif_timestamp).toLocaleString() : '',
                device: item.exif_device || evidenceItem?.exif_device || ''
            };

            // Organize into folders
            if (category && organized[category]) {
                if (infraType && organized[category][infraType]) {
                    organized[category][infraType].push(pointData);
                } else if (infraType) {
                    organized[category]['Other'].push(pointData);
                } else {
                    organized[category]['Other'].push(pointData);
                }
            } else {
                organized['Uncategorized'].push(pointData);
            }
        });

        // Generate placemark XML
        const generatePlacemark = (point) => {
            return `
            <Placemark>
                <name>${point.name}</name>
                <description><![CDATA[
                    <b>Status:</b> ${point.hasEvidence ? 'Evidence Captured' : 'Pending'}<br/>
                    ${point.category ? `<b>Kategori:</b> ${point.category}<br/>` : ''}
                    ${point.infraType ? `<b>Jenis:</b> ${point.infraType}<br/>` : ''}
                    <b>Coordinates:</b> ${point.lat}, ${point.lng}<br/>
                    <b>Source:</b> ${point.coordSource}<br/>
                    ${point.timestamp ? `<b>Captured:</b> ${point.timestamp}<br/>` : ''}
                    ${point.device ? `<b>Device:</b> ${point.device}<br/>` : ''}
                    ${point.photoUrl ? `<img src="${point.photoUrl}" width="200"/>` : 'No photo available'}
                ]]></description>
                <styleUrl>#${point.styleId}</styleUrl>
                <Point>
                    <coordinates>${point.lng},${point.lat},0</coordinates>
                </Point>
            </Placemark>`;
        };

        // Build folder structure
        ['Existing', 'Plan'].forEach(cat => {
            const categoryData = organized[cat];
            const infraTypes = ['ODC', 'ODP', 'Tiang', 'Kabel', 'Closure', 'Other'];
            const hasAnyPoints = infraTypes.some(type => categoryData[type].length > 0);

            if (hasAnyPoints) {
                kmlContent += `
    <Folder>
        <name>${cat.toUpperCase()}</name>
        <open>1</open>`;

                infraTypes.forEach(infraType => {
                    const points = categoryData[infraType];
                    if (points.length > 0) {
                        kmlContent += `
        <Folder>
            <name>${infraType}</name>
            <open>0</open>`;
                        points.forEach(point => {
                            kmlContent += generatePlacemark(point);
                        });
                        kmlContent += `
        </Folder>`;
                    }
                });

                kmlContent += `
    </Folder>`;
            }
        });

        // Add uncategorized points
        if (organized['Uncategorized'].length > 0) {
            kmlContent += `
    <Folder>
        <name>Uncategorized</name>
        <open>0</open>`;
            organized['Uncategorized'].forEach(point => {
                kmlContent += generatePlacemark(point);
            });
            kmlContent += `
    </Folder>`;
        }

        kmlContent += `
</Document>
</kml>`;

        return kmlContent;
    };

    const handleDownloadKML = () => {
        const kmlContent = generateKML();
        const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `evidence_report_${new Date().toISOString().split('T')[0]}.kml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadCSV = () => {
        let csvContent = "No,Point ID,Name,Latitude,Longitude,Photo URL,Status,Timestamp\n";

        evidenceList.forEach((item, idx) => {
            const lat = item.latitude || item.exif_latitude || '';
            const lng = item.longitude || item.exif_longitude || '';
            const hasEvidence = item.evidence?.length > 0 || item.photo_url;
            const photoUrl = item.photo_url || item.evidence?.[0]?.photo_url || '';
            const timestamp = item.created_at ? new Date(item.created_at).toLocaleString() : '';

            csvContent += `${idx + 1},"${item.point_id || ''}","${item.name || ''}",${lat},${lng},"${photoUrl}","${hasEvidence ? 'Evidence' : 'Pending'}","${timestamp}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `evidence_report_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const selectedProject = projects.find(p => p.id === selectedProjectId);

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-dark relative">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "24px 24px" }}></div>

            {/* Top Header */}
            <header className="h-20 flex-shrink-0 px-8 flex items-center justify-between border-b border-border-dark bg-[#131416]/80 backdrop-blur-md z-10">
                <div>
                    <h2 className="text-white text-2xl font-heading font-bold leading-tight tracking-tight">Report Generation Center</h2>
                    <p className="text-slate-400 text-sm">Export evidence data with KML coordinates</p>
                </div>
            </header>

            {/* Content Split */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 overflow-hidden">
                {/* Left Column: Configuration */}
                <div className="w-full lg:w-[400px] flex-shrink-0 flex flex-col gap-6">
                    <div className="flex-1 bg-surface-dark border border-border-dark rounded-lg flex flex-col overflow-y-auto shadow-2xl">
                        <div className="p-5 border-b border-border-dark bg-[#1c1e20]">
                            <div className="flex items-center gap-2 text-primary mb-1">
                                <span className="material-symbols-outlined text-[20px]">tune</span>
                                <span className="text-xs font-bold uppercase tracking-widest">Configuration</span>
                            </div>
                            <h3 className="text-white font-heading text-xl font-bold">Generate Report</h3>
                        </div>

                        <div className="p-6 flex flex-col gap-6 h-full">
                            {/* Project Select */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-slate-300 text-sm font-medium">Select Project</label>
                                    <button
                                        onClick={() => setIsManageModalOpen(true)}
                                        className="text-[10px] text-primary hover:underline uppercase font-bold tracking-wider flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">settings</span>
                                        Manage
                                    </button>
                                </div>
                                <div className="relative">
                                    <select
                                        value={selectedProjectId}
                                        onChange={(e) => setSelectedProjectId(e.target.value)}
                                        className="w-full bg-input-bg border border-border-dark text-white text-sm rounded h-12 px-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                                    >
                                        {projects.length === 0 && (
                                            <option value="">No projects found</option>
                                        )}
                                        {projects.map(project => (
                                            <option key={project.id} value={project.id}>
                                                {project.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                        <span className="material-symbols-outlined">expand_more</span>
                                    </div>
                                </div>
                            </div>

                            {/* Project Info */}
                            {selectedProject && (
                                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                                    <div className="flex items-center gap-2 text-primary mb-2">
                                        <span className="material-symbols-outlined text-[18px]">info</span>
                                        <span className="text-xs font-bold uppercase">Project Info</span>
                                    </div>
                                    <p className="text-white font-medium">{selectedProject.name}</p>
                                    <p className="text-slate-400 text-sm">{selectedProject.region} • {selectedProject.description || 'No description'}</p>
                                </div>
                            )}

                            {/* Divider */}
                            <div className="h-px bg-border-dark w-full"></div>

                            {/* Export Format */}
                            <div className="flex flex-col gap-3">
                                <label className="text-slate-300 text-sm font-medium">Export Format</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="cursor-pointer">
                                        <input
                                            checked={exportFormat === 'kml'}
                                            onChange={() => setExportFormat('kml')}
                                            className="peer sr-only"
                                            name="format"
                                            type="radio"
                                            value="kml"
                                        />
                                        <div className="flex flex-col items-center justify-center gap-2 p-4 rounded border border-border-dark bg-input-bg peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary transition-all hover:bg-white/5">
                                            <span className="material-symbols-outlined text-[28px]">map</span>
                                            <span className="text-sm font-medium">KML File</span>
                                        </div>
                                    </label>
                                    <label className="cursor-pointer">
                                        <input
                                            checked={exportFormat === 'csv'}
                                            onChange={() => setExportFormat('csv')}
                                            className="peer sr-only"
                                            name="format"
                                            type="radio"
                                            value="csv"
                                        />
                                        <div className="flex flex-col items-center justify-center gap-2 p-4 rounded border border-border-dark bg-input-bg peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary transition-all hover:bg-white/5">
                                            <span className="material-symbols-outlined text-[28px]">table_view</span>
                                            <span className="text-sm font-medium">CSV/Excel</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-3 mt-auto">
                                <div className="p-4 rounded-lg bg-[#1c1e20] border border-border-dark text-center">
                                    <p className="text-2xl font-bold text-white">{evidenceList.length}</p>
                                    <p className="text-xs text-slate-400">Total Points</p>
                                </div>
                                <div className="p-4 rounded-lg bg-[#1c1e20] border border-border-dark text-center">
                                    <p className="text-2xl font-bold text-primary">
                                        {evidenceList.filter(e => e.photo_url || e.evidence?.length > 0).length}
                                    </p>
                                    <p className="text-xs text-slate-400">With Evidence</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Preview */}
                <div className="flex-1 flex flex-col min-w-0 bg-surface-dark border border-border-dark rounded-lg overflow-hidden shadow-2xl relative">
                    {/* Header */}
                    <div className="h-16 border-b border-border-dark flex items-center justify-between px-6 bg-[#1c1e20]">
                        <div className="flex items-center gap-3">
                            <h3 className="text-white font-heading text-lg font-bold">Data Preview</h3>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wide flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Live Data
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                            <span>{evidenceList.length} Records</span>
                        </div>
                    </div>

                    {/* Table Container */}
                    <div className="flex-1 overflow-auto bg-[#18191b]">
                        {loading ? (
                            <div className="flex items-center justify-center h-full text-slate-400">
                                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : evidenceList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <span className="material-symbols-outlined text-[48px] mb-4 opacity-30">folder_open</span>
                                <p>No data for this project</p>
                                <p className="text-sm">Upload a KML file and add evidence first</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-[#1c1e20] z-10 shadow-sm border-b border-border-dark">
                                    <tr>
                                        <th className="py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-16">No.</th>
                                        <th className="py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Point ID</th>
                                        <th className="py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                                        <th className="py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Coordinates</th>
                                        <th className="py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Photo</th>
                                        <th className="py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-dark">
                                    {evidenceList.map((item, idx) => {
                                        const lat = item.latitude || item.exif_latitude;
                                        const lng = item.longitude || item.exif_longitude;
                                        const hasEvidence = item.evidence?.length > 0 || item.photo_url;
                                        const photoUrl = item.photo_url || item.evidence?.[0]?.photo_url;

                                        return (
                                            <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="py-3 px-4 text-sm text-slate-500">{String(idx + 1).padStart(2, '0')}</td>
                                                <td className="py-3 px-4 text-sm font-mono text-white">{item.point_id || '-'}</td>
                                                <td className="py-3 px-4 text-sm text-slate-400 truncate max-w-[150px]">{item.name || '-'}</td>
                                                <td className="py-3 px-4 text-sm font-mono text-slate-400">
                                                    {lat && lng ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : '-'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {photoUrl ? (
                                                        <div className="w-12 h-12 rounded bg-slate-800 border border-slate-700 overflow-hidden">
                                                            <img
                                                                src={photoUrl}
                                                                alt="Evidence"
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="w-12 h-12 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                                                            <span className="material-symbols-outlined text-[20px]">no_photography</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${hasEvidence
                                                        ? 'bg-[#42C942]/10 text-[#42C942] border border-[#42C942]/20'
                                                        : 'bg-[#E6AA1A]/10 text-[#E6AA1A] border border-[#E6AA1A]/20'
                                                        }`}>
                                                        {hasEvidence ? 'Evidence' : 'Pending'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="h-20 border-t border-border-dark bg-[#1c1e20] p-4 flex items-center justify-end gap-3 z-20">
                        <button
                            onClick={handleDownloadCSV}
                            disabled={evidenceList.length === 0}
                            className="px-5 py-2.5 rounded border border-border-dark text-slate-300 hover:text-white hover:border-slate-500 hover:bg-white/5 transition-all text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="material-symbols-outlined text-[20px]">table_view</span>
                            Download CSV
                        </button>
                        <button
                            onClick={handleDownloadKML}
                            disabled={evidenceList.length === 0}
                            className="px-5 py-2.5 rounded bg-primary hover:bg-primary/90 text-white shadow-[0_0_15px_-3px_rgba(27,152,141,0.4)] transition-all text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="material-symbols-outlined text-[20px]">map</span>
                            Download KML
                        </button>
                    </div>
                </div>
            </div>

            <ManageProjectsModal
                isOpen={isManageModalOpen}
                onClose={() => setIsManageModalOpen(false)}
                onUpdate={fetchProjects}
            />
        </main >
    )
}

export default Reports
