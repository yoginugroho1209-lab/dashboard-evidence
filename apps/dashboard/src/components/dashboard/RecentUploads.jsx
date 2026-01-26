import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const UploadRow = ({ id, location, photoUrl, uploaderEmail, status, statusText, statusIcon, time }) => {
    return (
        <tr className="group hover:bg-white/[0.02] transition-colors">
            <td className="py-4 font-medium text-white group-hover:text-primary transition-colors">{id}</td>
            <td className="py-4">
                <div className="flex items-center gap-2">
                    {photoUrl ? (
                        <div className="h-8 w-12 rounded bg-cover bg-center" style={{ backgroundImage: `url('${photoUrl}')` }}></div>
                    ) : (
                        <div className="h-8 w-12 rounded bg-gray-700 flex items-center justify-center">
                            <span className="material-symbols-outlined text-gray-500 text-sm">image</span>
                        </div>
                    )}
                    <span className="truncate max-w-[150px]">{location || 'Unknown Location'}</span>
                </div>
            </td>
            <td className="py-4">
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                        {uploaderEmail ? uploaderEmail.substring(0, 2).toUpperCase() : '??'}
                    </div>
                    <span className="truncate max-w-[120px]">{uploaderEmail || 'Unknown'}</span>
                </div>
            </td>
            <td className="py-4">
                <div className={`inline-flex items-center gap-1.5 rounded-full ${status === 'verified' ? 'bg-status-success/10 text-status-success border-status-success/20' : 'bg-status-warning/10 text-status-warning border-status-warning/20'} border px-2.5 py-1 text-xs font-medium`}>
                    <span className="material-symbols-outlined text-[14px]">{statusIcon}</span>
                    {statusText}
                </div>
            </td>
            <td className="py-4 text-right whitespace-nowrap">{time}</td>
        </tr>
    )
}

const RecentUploads = () => {
    const [uploads, setUploads] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRecentUploads = async () => {
        const { data, error } = await supabase
            .from('evidence')
            .select(`
                id,
                photo_url,
                created_at,
                point_id,
                points (
                    point_id,
                    name
                )
            `)
            .order('created_at', { ascending: false })
            .limit(10);

        if (data) {
            // Get uploader info
            const uploadsWithUser = await Promise.all(
                data.map(async (item) => {
                    // Try to get user email from uploaded_by if exists
                    let uploaderEmail = 'Teknisi';

                    return {
                        ...item,
                        uploaderEmail
                    };
                })
            );
            setUploads(uploadsWithUser);
        }
        setLoading(false);
    };

    const formatTimeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Baru saja';
        if (diffMins < 60) return `${diffMins} menit lalu`;
        if (diffHours < 24) return `${diffHours} jam lalu`;
        return `${diffDays} hari lalu`;
    };

    useEffect(() => {
        fetchRecentUploads();

        // 🔄 REALTIME: Subscribe to evidence changes
        const channel = supabase
            .channel('dashboard-recent-uploads')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'evidence' },
                () => {
                    console.log('🔄 Recent Uploads: Evidence changed');
                    fetchRecentUploads();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-border-dark bg-surface-dark p-6">
            <div className="flex items-center justify-between">
                <h3 className="font-heading text-lg font-bold text-white">Recent Uploads</h3>
                <a href="/reports" className="text-sm font-medium text-primary hover:text-primary/80">View All</a>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="border-b border-border-dark text-xs uppercase text-gray-500">
                        <tr>
                            <th className="py-3 font-semibold tracking-wider">Evidence ID</th>
                            <th className="py-3 font-semibold tracking-wider">Location</th>
                            <th className="py-3 font-semibold tracking-wider">Uploader</th>
                            <th className="py-3 font-semibold tracking-wider">Status</th>
                            <th className="py-3 font-semibold tracking-wider text-right">Time</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dark">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="py-8 text-center text-gray-500">
                                    <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
                                    Loading...
                                </td>
                            </tr>
                        ) : uploads.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="py-8 text-center text-gray-500">
                                    Belum ada evidence yang diupload
                                </td>
                            </tr>
                        ) : (
                            uploads.map((upload, index) => (
                                <UploadRow
                                    key={upload.id}
                                    id={`#EV-${String(index + 1).padStart(4, '0')}`}
                                    location={upload.points?.name || upload.points?.point_id || 'Point tidak diketahui'}
                                    photoUrl={upload.photo_url}
                                    uploaderEmail={upload.uploaderEmail}
                                    status="verified"
                                    statusText="Uploaded"
                                    statusIcon="check_circle"
                                    time={formatTimeAgo(upload.created_at)}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RecentUploads;
