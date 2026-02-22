
import DashboardLayout from '../components/layout/DashboardLayout';
import SovereignTable from '../components/sovereign/SovereignTable';

export default function MasterDataPage({ tableName }: { tableName: string }) {
    return (
        <DashboardLayout>
            <div className="h-[calc(100vh-140px)] min-h-[500px]">
                <SovereignTable tableName={tableName} />
            </div>
        </DashboardLayout>
    );
}
