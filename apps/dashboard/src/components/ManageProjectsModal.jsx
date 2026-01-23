import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const ManageProjectsModal = ({ isOpen, onClose, onUpdate }) => {
    if (!isOpen) return null;

    const [activeTab, setActiveTab] = useState('active'); // 'active' or 'trash'
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selection, setSelection] = useState([]);

    // Fetch projects based on active tab
    const fetchProjects = async () => {
        setLoading(true);
        setSelection([]);
        try {
            let query = supabase
                .from('projects')
                .select('*')
                .order('created_at', { ascending: false });

            if (activeTab === 'active') {
                query = query.is('deleted_at', null);
            } else {
                query = query.not('deleted_at', 'is', null);
            }

            const { data, error } = await query;

            if (error) throw error;
            setProjects(data || []);
        } catch (error) {
            console.error('Error fetching projects:', error);
            alert('Failed to load projects');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, [activeTab]);

    const handleSelect = (id) => {
        setSelection(prev =>
            prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selection.length === projects.length) {
            setSelection([]);
        } else {
            setSelection(projects.map(p => p.id));
        }
    };

    // Soft Delete (Move to Trash)
    const handleMoveToTrash = async () => {
        if (!confirm(`Are you sure you want to move ${selection.length} project(s) to Trash?`)) return;

        try {
            const { error } = await supabase
                .from('projects')
                .update({ deleted_at: new Date().toISOString() })
                .in('id', selection);

            if (error) throw error;

            await fetchProjects();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error moving to trash:', error);
            alert('Failed to move to trash');
        }
    };

    // Restore from Trash
    const handleRestore = async () => {
        if (!confirm(`Are you sure you want to restore ${selection.length} project(s)?`)) return;

        try {
            const { error } = await supabase
                .from('projects')
                .update({ deleted_at: null })
                .in('id', selection);

            if (error) throw error;

            await fetchProjects();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error restoring:', error);
            alert('Failed to restore projects');
        }
    };

    // Permanent Delete
    const handlePermanentDelete = async () => {
        if (!confirm(`WARNING: This will PERMANENTLY DELETE ${selection.length} project(s) and ALL associated evidence. This cannot be undone. Are you sure?`)) return;

        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .in('id', selection);

            if (error) throw error;

            await fetchProjects();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error deleting permanently:', error);
            alert('Failed to delete projects permanently. Ensure related data is deleted first if no cascade is set up.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface-dark border border-border-dark w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border-dark bg-[#1c1e20]">
                    <div>
                        <h3 className="text-white text-lg font-bold">Manage Projects</h3>
                        <p className="text-slate-400 text-xs">Organize or delete your projects</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border-dark bg-[#18191b]">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'active'
                                ? 'border-primary text-primary bg-primary/5'
                                : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Active Projects
                    </button>
                    <button
                        onClick={() => setActiveTab('trash')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'trash'
                                ? 'border-red-500 text-red-500 bg-red-500/5'
                                : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Trash Bin
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-[#18191b] min-h-[300px]">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-slate-500">
                            <div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                            <span className="material-symbols-outlined text-[40px] mb-2">
                                {activeTab === 'active' ? 'folder_off' : 'delete_forever'}
                            </span>
                            <p className="text-sm">
                                {activeTab === 'active' ? 'No active projects found' : 'Trash bin is empty'}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {/* Select All Header */}
                            <div className="flex items-center gap-3 px-3 py-2 border-b border-border-dark mb-2">
                                <input
                                    type="checkbox"
                                    checked={selection.length === projects.length}
                                    onChange={handleSelectAll}
                                    className="rounded border-slate-600 bg-transparent text-primary focus:ring-primary h-4 w-4"
                                />
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    {selection.length} Selected
                                </span>
                            </div>

                            {/* List */}
                            {projects.map(project => (
                                <label
                                    key={project.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selection.includes(project.id)
                                            ? 'bg-primary/10 border-primary/30'
                                            : 'bg-[#1c1e20] border-border-dark hover:border-slate-600'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selection.includes(project.id)}
                                        onChange={() => handleSelect(project.id)}
                                        className="rounded border-slate-600 bg-transparent text-primary focus:ring-primary h-4 w-4"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-medium truncate">{project.name}</span>
                                            {project.region && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                                    {project.region}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 flex gap-2">
                                            <span>Created: {new Date(project.created_at).toLocaleDateString()}</span>
                                            {project.deleted_at && (
                                                <span className="text-red-400">
                                                    Deleted: {new Date(project.deleted_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-border-dark bg-[#1c1e20] flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                        {activeTab === 'trash' ? 'Items in trash can be restored.' : 'Deleted items move to trash.'}
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Close
                        </button>

                        {selection.length > 0 && activeTab === 'active' && (
                            <button
                                onClick={handleMoveToTrash}
                                className="px-4 py-2 rounded bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all text-sm font-medium flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                Move to Trash ({selection.length})
                            </button>
                        )}

                        {selection.length > 0 && activeTab === 'trash' && (
                            <>
                                <button
                                    onClick={handleRestore}
                                    className="px-4 py-2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all text-sm font-medium flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-[18px]">restore_from_trash</span>
                                    Restore ({selection.length})
                                </button>
                                <button
                                    onClick={handlePermanentDelete}
                                    className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition-all text-sm font-medium flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                                    Delete Forever
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManageProjectsModal;
