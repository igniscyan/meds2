import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function DashboardCard({ title, value }) {
    return (_jsxs("div", { className: "bg-gray-50 p-4 rounded-lg border border-gray-200", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: title }), _jsx("p", { className: "text-3xl font-bold text-blue-600", children: value })] }));
}
