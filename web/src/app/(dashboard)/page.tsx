import { ApproachStateGrid } from "@/components/approach-state-grid";
import { DecisionComparisonCard } from "@/components/decision-comparison-card";
import { JunctionSummaryCards } from "@/components/junction-summary-cards";
import { mockLatestDecision, mockTrafficState } from "@/lib/mock-data";

export default function LiveStatePage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <JunctionSummaryCards />
      <ApproachStateGrid trafficState={mockTrafficState} />
      <DecisionComparisonCard decision={mockLatestDecision} />
    </div>
  );
}
