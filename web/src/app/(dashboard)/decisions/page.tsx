import { DecisionLogTable } from "@/components/decision-log-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { mockDecisionLog } from "@/lib/mock-data";

export default function DecisionsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision Log</CardTitle>
        <CardDescription>
          Every scheduler decision that accepted, held, or overrode the model's
          recommendation, with its reason code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DecisionLogTable decisions={mockDecisionLog} />
      </CardContent>
    </Card>
  );
}
