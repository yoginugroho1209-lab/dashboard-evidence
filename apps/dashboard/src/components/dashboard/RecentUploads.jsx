import React from 'react';

const UploadRow = ({ id, location, locationImg, techInitials, techName, techColor, status, statusText, statusIcon, time }) => {
    return (
        <tr className="group hover:bg-white/[0.02] transition-colors">
            <td className="py-4 font-medium text-white group-hover:text-primary transition-colors">{id}</td>
            <td className="py-4">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-12 rounded bg-cover bg-center" data-location={location} style={{ backgroundImage: `url('${locationImg}')` }}></div>
                    <span>{location}</span>
                </div>
            </td>
            <td className="py-4">
                <div className="flex items-center gap-2">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full ${techColor} text-[10px] font-bold`}>{techInitials}</div>
                    <span>{techName}</span>
                </div>
            </td>
            <td className="py-4">
                <div className={`inline-flex items-center gap-1.5 rounded-full ${status === 'verified' ? 'bg-status-success/10 text-status-success border-status-success/20' : 'bg-status-warning/10 text-status-warning border-status-warning/20'} border px-2.5 py-1 text-xs font-medium`}>
                    <span className="material-symbols-outlined text-[14px]">{statusIcon}</span>
                    {statusText}
                </div>
            </td>
            <td className="py-4 text-right">{time}</td>
        </tr>
    )
}

const RecentUploads = () => {
    return (
        <div className="flex flex-col gap-4 rounded-xl border border-border-dark bg-surface-dark p-6">
            <div className="flex items-center justify-between">
                <h3 className="font-heading text-lg font-bold text-white">Recent Uploads</h3>
                <button className="text-sm font-medium text-primary hover:text-primary/80">View All</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="border-b border-border-dark text-xs uppercase text-gray-500">
                        <tr>
                            <th className="py-3 font-semibold tracking-wider">Evidence ID</th>
                            <th className="py-3 font-semibold tracking-wider">Location</th>
                            <th className="py-3 font-semibold tracking-wider">Technician</th>
                            <th className="py-3 font-semibold tracking-wider">Status</th>
                            <th className="py-3 font-semibold tracking-wider text-right">Time</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dark">
                        <UploadRow
                            id="#TE-2049"
                            location="Cape Town, CBD"
                            locationImg="https://lh3.googleusercontent.com/aida-public/AB6AXuBl7VBhpclg6w9CJ2HfmwGx_i58Ca7wy-m4XNPWuMHnmUV3N7lwB5uttAS75qg12S2-lVzJXFNAK7c6kBZXu_CH0RGvv6bhNrYBHGcxYLG0TPNUIel0WaD5xvPF2U3tABWK1AIckZFI50o8iG6wDR_mUiay8oKYFow-Uh8ttsdS3cayRUnn9v5xL1dvuo8Rc-qF5_Vu7_hA39Rdofx34cqpMgqn9QQkX1SkxGaqf1R8akBGJtFgMottMRMQCvIHyjOjfEqQ9Yk6aryI"
                            techInitials="JD"
                            techName="John Doe"
                            techColor="bg-blue-500/20 text-blue-400"
                            status="verified"
                            statusText="Verified"
                            statusIcon="check_circle"
                            time="25 min ago"
                        />
                        <UploadRow
                            id="#TE-2048"
                            location="Pretoria, Arcadia"
                            locationImg="https://lh3.googleusercontent.com/aida-public/AB6AXuDlvBTsTuWMbzUpW6-n_FzrK5Huh8Mm-sql8nAG_q9LSb4vSUpqdgLny6Q0sQ3poQ6PAgdn0dZjZ3wb6_KTp5jO2LQehWHUlkIj1uRcKWiPSUZEDff-m7ECUQQ9NIsfgsV82-JPVl7D39010Ht7ptNbY_Cs85wBYzuLU-qAkq_Ht1_cOm-w3781zZR9hXaZidq0BK7-J3F_cO0IlCmUPFHbLEqTtRZ7-lG0bPs4T0Qmx3mu_ITiL5-CIe5hOuRYKUshobQW0Vcgj0QA"
                            techInitials="SM"
                            techName="Sarah M."
                            techColor="bg-purple-500/20 text-purple-400"
                            status="review"
                            statusText="Review Needed"
                            statusIcon="warning"
                            time="42 min ago"
                        />
                        <UploadRow
                            id="#TE-2047"
                            location="Durban, Umhlanga"
                            locationImg="https://lh3.googleusercontent.com/aida-public/AB6AXuDyV1EygS-FKlaf7jnVenrCjKrmEZ8pLUFUBljZ5kuud09NtGYKmsS0_wOfhwd4sGo5nMEbOt3ng71Kr-5O2pNefPuiLX-E0rAPRmrrnNREMHEk1IrR-qldHnsSiyQmIp8e0Um-gntwxfrT3hvJx7NI2crxc_-bEPb3SWRkhJPmiuE9VYcJAJBKCypeRq77MQhTjzScd9fQ6jVV9QtQZvRPaLOuKf4NwvCabRh4Sj10WrfxyYCX7BLQODH8B9tbrZyqvTwyYNUd7_Di"
                            techInitials="MK"
                            techName="Mike K."
                            techColor="bg-orange-500/20 text-orange-400"
                            status="verified"
                            statusText="Verified"
                            statusIcon="check_circle"
                            time="1 hr ago"
                        />
                        <UploadRow
                            id="#TE-2046"
                            location="Johannesburg, Sandton"
                            locationImg="https://lh3.googleusercontent.com/aida-public/AB6AXuDcdktgkhUo4f_wf_G42XFoQ0PBFyLMPJofHwgCBzYXpFYEpIM-lwWBqIzEZ5BTY5C1e4E1KCCq6SD1kGjUI7bl2ycPSwEjt2eEfs7cvUdtVJ9Z5zcdj1nHXbGX7vLKC5Ed75QjqkU9JbU2-D9NZ_q9gyKgE2GhbxRYtNYeHUcx8s6EGpSQqveJSEeGbfiXqeFrU1sQNInfPUMNcFHnWa5U0retIYs1BOnpJYYKQwoUrDh04oTMrCbEOzaiRiw8fOgAfntKXo70pCuh"
                            techInitials="TP"
                            techName="Thabo P."
                            techColor="bg-teal-500/20 text-teal-400"
                            status="verified"
                            statusText="Verified"
                            statusIcon="check_circle"
                            time="2 hrs ago"
                        />
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RecentUploads;
