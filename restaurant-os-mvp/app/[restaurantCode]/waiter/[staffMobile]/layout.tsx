import BottomNav from '../components/BottomNav';
import WaiterAlertSystem from '../components/WaiterAlertSystem';
import { OrderNotificationProvider } from '../context/OrderNotificationContext';

export default function WaiterStaffLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <OrderNotificationProvider>
            {/* Realtime service-request takeover alerts */}
            <WaiterAlertSystem />

            {/* Authenticated shift content */}
            <div id="waiter-page-scroll-container" className="flex-1 relative overflow-y-auto no-scrollbar">
                {children}
            </div>

            {/* Bottom navigation — Tables / Menu / Requests / Profile */}
            <BottomNav />
        </OrderNotificationProvider>
    );
}
