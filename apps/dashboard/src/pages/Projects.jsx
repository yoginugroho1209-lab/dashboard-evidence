import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import JSZip from 'jszip'

const Projects = () => {
    const [kmlFile, setKmlFile] = useState(null);
    const [parsedPoints, setParsedPoints] = useState([]);
    const [projectName, setProjectName] = useState('');
    const [region, setRegion] = useState('TREG I Sumatera');
    const [description, setDescription] = useState('');
    const [infrastructureType, setInfrastructureType] = useState('(All)');
    const [uploadStatus, setUploadStatus] = useState('idle'); // idle, parsing, saving, done, error
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();
    }, []);

    // Parse KML content (text) and extract coordinates
    const parseKmlContent = (kmlText) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlText, 'text/xml');

        const points = [];

        // Find all Placemark elements
        const placemarks = xmlDoc.getElementsByTagName('Placemark');

        for (let i = 0; i < placemarks.length; i++) {
            const placemark = placemarks[i];

            // Get name
            const nameEl = placemark.getElementsByTagName('name')[0];
            const name = nameEl ? nameEl.textContent : `Point ${i + 1}`;

            // Get coordinates from Point
            const pointEl = placemark.getElementsByTagName('Point')[0];
            if (pointEl) {
                const coordsEl = pointEl.getElementsByTagName('coordinates')[0];
                if (coordsEl) {
                    const coordsText = coordsEl.textContent.trim();
                    const [lng, lat, alt] = coordsText.split(',').map(c => parseFloat(c.trim()));

                    if (!isNaN(lat) && !isNaN(lng)) {
                        points.push({
                            point_id: `P-${String(i + 1).padStart(4, '0')}`,
                            name: name,
                            latitude: lat,
                            longitude: lng,
                            altitude: alt || 0,
                            status: 'planned'
                        });
                    }
                }
            }

            // Check for LineString coordinates (for paths)
            const lineStringEl = placemark.getElementsByTagName('LineString')[0];
            if (lineStringEl) {
                const coordsEl = lineStringEl.getElementsByTagName('coordinates')[0];
                if (coordsEl) {
                    const coordsText = coordsEl.textContent.trim();
                    const coordPairs = coordsText.split(/\s+/);
                    coordPairs.forEach((pair, j) => {
                        const [lng, lat, alt] = pair.split(',').map(c => parseFloat(c.trim()));
                        if (!isNaN(lat) && !isNaN(lng)) {
                            points.push({
                                point_id: `L-${String(i + 1).padStart(2, '0')}-${String(j + 1).padStart(3, '0')}`,
                                name: `${name} - Point ${j + 1}`,
                                latitude: lat,
                                longitude: lng,
                                altitude: alt || 0,
                                status: 'planned'
                            });
                        }
                    });
                }
            }

            // Check for Polygon coordinates
            const polygonEl = placemark.getElementsByTagName('Polygon')[0];
            if (polygonEl) {
                const coordsEl = polygonEl.getElementsByTagName('coordinates')[0];
                if (coordsEl) {
                    const coordsText = coordsEl.textContent.trim();
                    const coordPairs = coordsText.split(/\s+/);
                    coordPairs.forEach((pair, j) => {
                        const [lng, lat, alt] = pair.split(',').map(c => parseFloat(c.trim()));
                        if (!isNaN(lat) && !isNaN(lng)) {
                            points.push({
                                point_id: `PG-${String(i + 1).padStart(2, '0')}-${String(j + 1).padStart(3, '0')}`,
                                name: `${name} - Vertex ${j + 1}`,
                                latitude: lat,
                                longitude: lng,
                                altitude: alt || 0,
                                status: 'planned'
                            });
                        }
                    });
                }
            }
        }

        return points;
    };

    // Extract KML from KMZ file (which is a ZIP archive)
    const extractKmlFromKmz = async (file) => {
        const zip = await JSZip.loadAsync(file);

        // Find the .kml file inside the KMZ
        let kmlContent = null;
        for (const filename of Object.keys(zip.files)) {
            if (filename.endsWith('.kml')) {
                kmlContent = await zip.files[filename].async('string');
                break;
            }
        }

        if (!kmlContent) {
            throw new Error('No KML file found inside KMZ archive');
        }

        return kmlContent;
    };

    // Read file as text (for plain KML files)
    const readFileAsText = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setKmlFile(file);
        setUploadStatus('parsing');
        setError(null);

        try {
            let kmlContent;
            const isKmz = file.name.toLowerCase().endsWith('.kmz');

            if (isKmz) {
                // Extract KML from KMZ (ZIP archive)
                kmlContent = await extractKmlFromKmz(file);
            } else {
                // Read as plain text for .kml files
                kmlContent = await readFileAsText(file);
            }

            const points = parseKmlContent(kmlContent);
            setParsedPoints(points);
            setUploadStatus('idle');

            // Auto-generate project name from filename if empty
            if (!projectName) {
                const baseName = file.name.replace(/\.(kml|kmz)$/i, '');
                setProjectName(baseName);
            }
        } catch (err) {
            console.error('Parse error:', err);
            setError('Failed to parse file: ' + err.message);
            setUploadStatus('error');
        }
    };

    const handleCreateProject = async () => {
        if (!projectName.trim()) {
            setError('Please enter a project name');
            return;
        }
        if (parsedPoints.length === 0) {
            setError('Please upload a KML file first');
            return;
        }

        setUploadStatus('saving');
        setError(null);

        try {
            // 1. Create project record
            const { data: projectData, error: projectError } = await supabase
                .from('projects')
                .insert([
                    {
                        name: projectName,
                        description: description,
                        region: region,
                        user_id: user?.id || null,
                    }
                ])
                .select()
                .single();

            if (projectError) throw projectError;

            // 2. Insert all points with project_id
            const pointsToInsert = parsedPoints.map(p => ({
                project_id: projectData.id,
                point_id: p.point_id,
                name: p.name,
                latitude: p.latitude,
                longitude: p.longitude,
                status: p.status,
            }));

            const { error: pointsError } = await supabase
                .from('points')
                .insert(pointsToInsert);

            if (pointsError) throw pointsError;

            setUploadStatus('done');
        } catch (err) {
            console.error('Save error:', err);
            setError('Failed to save project: ' + err.message);
            setUploadStatus('error');
        }
    };

    const resetForm = () => {
        setKmlFile(null);
        setParsedPoints([]);
        setProjectName('');
        setDescription('');
        setUploadStatus('idle');
        setError(null);
    };

    return (
        <main className="flex-1 relative h-full w-full bg-[#131416] isolate overflow-hidden flex flex-col">
            {/* Header / Breadcrumb Area */}
            <div className="h-16 border-b border-white/5 flex items-center px-6 justify-between bg-[#131416]">
                <div className="flex items-center gap-2 text-sm text-[#97c4c0]">
                    <span>Home</span>
                    <span>/</span>
                    <span className="text-white font-medium">Projects</span>
                </div>
                {user && (
                    <div className="text-right">
                        <p className="text-xs text-slate-500">Logged in as</p>
                        <p className="text-sm text-white">{user.email}</p>
                    </div>
                )}
            </div>

            {/* Main Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="max-w-[1400px] mx-auto">
                    {/* Page Title */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-heading font-bold text-white mb-2">Project Configuration</h2>
                        <p className="text-[#97c4c0] text-sm">Upload KML file to create a new project with coordinate points.</p>
                    </div>

                    {/* Success Message */}
                    {uploadStatus === 'done' && (
                        <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined">check_circle</span>
                                <span>Project "{projectName}" created successfully with {parsedPoints.length} points!</span>
                            </div>
                            <button onClick={resetForm} className="text-sm underline hover:no-underline">Create Another</button>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
                            <span className="material-symbols-outlined">error</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Left Column: Input Forms */}
                        <div className="lg:col-span-5 space-y-6">

                            {/* Upload Zone */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer min-h-[200px] transition-all ${kmlFile
                                    ? 'border-primary bg-primary/5'
                                    : 'border-white/10 bg-white/5 hover:border-primary/50'
                                    }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".kml,.kmz"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />

                                {uploadStatus === 'parsing' ? (
                                    <>
                                        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4"></div>
                                        <p className="text-white">Parsing KML file...</p>
                                    </>
                                ) : kmlFile ? (
                                    <>
                                        <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center mb-4 text-primary">
                                            <span className="material-symbols-outlined text-[24px]">check</span>
                                        </div>
                                        <h3 className="text-white font-medium mb-1">{kmlFile.name}</h3>
                                        <p className="text-xs text-primary mb-2">{parsedPoints.length} points detected</p>
                                        <p className="text-xs text-[#97c4c0]">Click to change file</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="size-12 rounded-full bg-white/10 flex items-center justify-center mb-4 text-[#97c4c0]">
                                            <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
                                        </div>
                                        <h3 className="text-white font-medium mb-1">Upload KML File</h3>
                                        <p className="text-xs text-[#97c4c0] mb-4">Click to select .kml or .kmz file</p>
                                    </>
                                )}
                            </div>

                            {/* Project Metadata Form */}
                            <div className="bg-[#1c312f] border border-white/10 rounded-xl p-6">
                                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/5">
                                    <span className="material-symbols-outlined text-primary">description</span>
                                    <h3 className="text-white font-medium">Project Metadata</h3>
                                </div>

                                <div className="space-y-5">
                                    {/* Project Name */}
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-wider text-[#97c4c0] font-bold mb-2">Project Name *</label>
                                        <input
                                            type="text"
                                            value={projectName}
                                            onChange={(e) => setProjectName(e.target.value)}
                                            className="w-full bg-[#131416] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder-white/20"
                                            placeholder="e.g. Fiber Expansion - Sector 7"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Region */}
                                        <div>
                                            <label className="block text-[10px] uppercase tracking-wider text-[#97c4c0] font-bold mb-2">Region</label>
                                            <div className="relative">
                                                <select
                                                    value={region}
                                                    onChange={(e) => setRegion(e.target.value)}
                                                    className="w-full bg-[#131416] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none cursor-pointer"
                                                >
                                                    <option value="TREG I Sumatera">TREG I Sumatera</option>
                                                    <option value="TREG II Jabodetabek">TREG II Jabodetabek</option>
                                                    <option value="TREG III Jawa Barat">TREG III Jawa Barat</option>
                                                    <option value="TREG IV Jateng & DIY">TREG IV Jateng & DIY</option>
                                                    <option value="TREG V Jatim Bali Nusra">TREG V Jatim Bali Nusra</option>
                                                    <option value="TREG VI Kalimantan">TREG VI Kalimantan</option>
                                                    <option value="TREG VII Kawasan Timur Indonesia">TREG VII KTI</option>
                                                </select>
                                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#97c4c0] pointer-events-none text-[18px]">expand_more</span>
                                            </div>
                                        </div>

                                        {/* Infrastructure Type */}
                                        <div>
                                            <label className="block text-[10px] uppercase tracking-wider text-[#97c4c0] font-bold mb-2">Jenis Infrastruktur</label>
                                            <div className="relative">
                                                <select
                                                    value={infrastructureType}
                                                    onChange={(e) => setInfrastructureType(e.target.value)}
                                                    className="w-full bg-[#131416] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none cursor-pointer"
                                                >
                                                    <option value="(All)">(All)</option>
                                                    <option value="Tiang">Tiang</option>
                                                    <option value="ODC">ODC</option>
                                                    <option value="ODP">ODP</option>
                                                    <option value="Closure">Closure</option>
                                                    <option value="Kabel">Kabel</option>
                                                </select>
                                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#97c4c0] pointer-events-none text-[18px]">expand_more</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-wider text-[#97c4c0] font-bold mb-2">Description (Optional)</label>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            className="w-full bg-[#131416] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none min-h-[80px] resize-none"
                                            placeholder="Project description..."
                                        ></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Points Preview */}
                        <div className="lg:col-span-7">
                            <div className="bg-[#1c312f] border border-white/10 rounded-xl p-1 h-full min-h-[500px] flex flex-col">
                                {/* Preview Header Bar */}
                                <div className="px-4 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary text-[18px]">pin_drop</span>
                                        <span className="text-xs font-mono text-primary font-bold uppercase tracking-widest">Points Preview</span>
                                    </div>
                                    <div className="text-xs text-[#97c4c0]">
                                        {parsedPoints.length} points
                                    </div>
                                </div>

                                {/* Points List */}
                                <div className="flex-1 rounded-lg bg-[#131416] relative overflow-hidden m-1 border border-white/5">
                                    {parsedPoints.length === 0 ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#97c4c0]">
                                            <span className="material-symbols-outlined text-[48px] mb-4 opacity-30">map</span>
                                            <p>Upload a KML file to see points</p>
                                        </div>
                                    ) : (
                                        <div className="absolute inset-0 overflow-auto p-4">
                                            <table className="w-full text-sm">
                                                <thead className="sticky top-0 bg-[#131416]">
                                                    <tr className="text-left text-[#97c4c0] text-xs uppercase tracking-wider">
                                                        <th className="pb-3 pr-4">ID</th>
                                                        <th className="pb-3 pr-4">Name</th>
                                                        <th className="pb-3 pr-4">Latitude</th>
                                                        <th className="pb-3">Longitude</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {parsedPoints.slice(0, 100).map((point, idx) => (
                                                        <tr key={idx} className="border-t border-white/5 text-white">
                                                            <td className="py-2 pr-4 font-mono text-primary">{point.point_id}</td>
                                                            <td className="py-2 pr-4 truncate max-w-[150px]">{point.name}</td>
                                                            <td className="py-2 pr-4 font-mono text-xs">{point.latitude.toFixed(6)}</td>
                                                            <td className="py-2 font-mono text-xs">{point.longitude.toFixed(6)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {parsedPoints.length > 100 && (
                                                <p className="text-center text-[#97c4c0] text-xs mt-4">
                                                    Showing first 100 of {parsedPoints.length} points
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="h-20 border-t border-white/10 bg-[#131416] flex items-center justify-end px-8 gap-4">
                <button
                    onClick={resetForm}
                    className="text-[#97c4c0] hover:text-white font-medium text-sm px-4 py-2 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleCreateProject}
                    disabled={uploadStatus === 'saving' || uploadStatus === 'done' || parsedPoints.length === 0}
                    className="bg-primary hover:bg-primary/90 text-white font-medium text-sm px-6 py-2.5 rounded shadow-lg shadow-primary/20 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {uploadStatus === 'saving' ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>Saving...</span>
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-[18px]">save</span>
                            <span>Create Project</span>
                        </>
                    )}
                </button>
            </div>
        </main>
    )
}

export default Projects
