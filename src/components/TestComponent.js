import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function TestComponent() {
    return (_jsx("div", { className: "p-4", children: _jsxs("div", { className: "bg-blue-500 text-white p-4 rounded-lg shadow-lg", children: [_jsx("h2", { className: "text-2xl font-bold", children: "Tailwind Test" }), _jsx("p", { className: "mt-2", children: "If you see this in white text on a blue background, Tailwind is working!" })] }) }));
}
