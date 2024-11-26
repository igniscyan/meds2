import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DashboardCard } from './DashboardCard';
export function Dashboard() {
    return (_jsxs("div", { className: "bg-white shadow rounded-lg p-6", children: [_jsx("h2", { className: "text-2xl font-bold mb-4", children: "Dashboard" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsx(DashboardCard, { title: "Total Patients", value: "0" }), _jsx(DashboardCard, { title: "Today's Encounters", value: "0" }), _jsx(DashboardCard, { title: "Active Queue", value: "0" })] })] }));
}
