import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import PocketBase from 'pocketbase';
import { Dashboard } from './components/Dashboard';
import { Patients } from './components/Patients';
import { Encounters } from './components/Encounters';
import { DrugInventory } from './components/DrugInventory';
import { TestComponent } from './components/TestComponent';
const pb = new PocketBase('http://127.0.0.1:8090');
function App() {
    return (_jsx(Router, { children: _jsxs("div", { className: "min-h-screen bg-gray-100", children: [_jsx("nav", { className: "bg-white shadow-lg", children: _jsx("div", { className: "max-w-7xl mx-auto px-4", children: _jsx("div", { className: "flex justify-between h-16", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0 flex items-center", children: _jsx("h1", { className: "text-xl font-bold text-blue-600", children: "Medical Records System" }) }), _jsxs("div", { className: "hidden sm:ml-6 sm:flex sm:space-x-8", children: [_jsx(Link, { to: "/", className: "inline-flex items-center px-1 pt-1 text-gray-900 hover:text-blue-600", children: "Dashboard" }), _jsx(Link, { to: "/patients", className: "inline-flex items-center px-1 pt-1 text-gray-900 hover:text-blue-600", children: "Patients" }), _jsx(Link, { to: "/encounters", className: "inline-flex items-center px-1 pt-1 text-gray-900 hover:text-blue-600", children: "Encounters" }), _jsx(Link, { to: "/drugs", className: "inline-flex items-center px-1 pt-1 text-gray-900 hover:text-blue-600", children: "Drug Inventory" })] })] }) }) }) }), _jsx("main", { className: "max-w-7xl mx-auto py-6 sm:px-6 lg:px-8", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "/patients", element: _jsx(Patients, {}) }), _jsx(Route, { path: "/encounters", element: _jsx(Encounters, {}) }), _jsx(Route, { path: "/drugs", element: _jsx(DrugInventory, {}) }), _jsx(Route, { path: "/test", element: _jsx(TestComponent, {}) })] }) })] }) }));
}
export default App;
