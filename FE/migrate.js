import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'src');
const appDir = path.join(__dirname, 'app');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// 1. Move auth
ensureDir(path.join(appDir, 'login'));
fs.writeFileSync(path.join(appDir, 'login', 'page.jsx'), 
`"use client";
import LoginPage from '../../src/views/auth/LoginPage';
export default function Page() { return <LoginPage />; }`);

// 2. Move dispatcher
ensureDir(path.join(appDir, 'dispatcher'));
fs.writeFileSync(path.join(appDir, 'dispatcher', 'layout.jsx'), 
`"use client";
import DispatcherLayout from '../../src/layouts/DispatcherLayout';
export default function Layout({ children }) { return <DispatcherLayout>{children}</DispatcherLayout>; }`);

fs.writeFileSync(path.join(appDir, 'dispatcher', 'page.jsx'), 
`"use client";
import DispatcherDashboard from '../../src/views/dispatcher/DispatcherDashboard';
export default function Page() { return <DispatcherDashboard />; }`);

ensureDir(path.join(appDir, 'dispatcher', 'orders'));
fs.writeFileSync(path.join(appDir, 'dispatcher', 'orders', 'page.jsx'), 
`"use client";
import OrderManagement from '../../../src/views/dispatcher/OrderManagement';
export default function Page() { return <OrderManagement />; }`);

ensureDir(path.join(appDir, 'dispatcher', 'fleet'));
fs.writeFileSync(path.join(appDir, 'dispatcher', 'fleet', 'page.jsx'), 
`"use client";
import FleetManagement from '../../../src/views/dispatcher/FleetManagement';
export default function Page() { return <FleetManagement />; }`);

ensureDir(path.join(appDir, 'dispatcher', 'tracking'));
fs.writeFileSync(path.join(appDir, 'dispatcher', 'tracking', 'page.jsx'), 
`"use client";
import TrackingMap from '../../../src/views/dispatcher/TrackingMap';
export default function Page() { return <TrackingMap />; }`);

// Now modify DispatcherLayout
const layoutPath = path.join(srcDir, 'layouts', 'DispatcherLayout.jsx');
if (fs.existsSync(layoutPath)) {
    let content = fs.readFileSync(layoutPath, 'utf8');
    content = content.replace(/import \{ Link, Outlet, useLocation \} from 'react-router-dom';/, 
`import Link from 'next/link';
import { usePathname } from 'next/navigation';`);
    content = content.replace(/const location = useLocation\(\);/, 'const pathname = usePathname();');
    content = content.replace(/location\.pathname/g, 'pathname');
    content = content.replace(/const DispatcherLayout = \(\) => \{/, 'const DispatcherLayout = ({ children }) => {');
    content = content.replace(/<Outlet \/>/g, '{children}');
    content = `"use client";\n` + content;
    fs.writeFileSync(layoutPath, content);
}

// Modify LoginPage to use next/link instead of react-router-dom
const loginPath = path.join(srcDir, 'views', 'auth', 'LoginPage.jsx');
if (fs.existsSync(loginPath)) {
    let content = fs.readFileSync(loginPath, 'utf8');
    content = content.replace(/import \{ Link \} from 'react-router-dom';/, "import Link from 'next/link';");
    content = `"use client";\n` + content;
    fs.writeFileSync(loginPath, content);
}

// Remove main.jsx and App.jsx
if (fs.existsSync(path.join(srcDir, 'main.jsx'))) fs.unlinkSync(path.join(srcDir, 'main.jsx'));
if (fs.existsSync(path.join(srcDir, 'App.jsx'))) fs.unlinkSync(path.join(srcDir, 'App.jsx'));

console.log("Migration script complete.");
