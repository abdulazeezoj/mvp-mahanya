import {
  BookOpenIcon,
  FlowArrowIcon,
  GavelIcon,
  MapPinIcon,
  ProhibitIcon,
  ShieldCheckIcon,
  TargetIcon,
} from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { SchedulerReasonCode } from "@/lib/types";

const OBJECTIVES: { title: string; description: string }[] = [
  {
    title: "Traffic count data collection",
    description:
      "Ingest vehicle-arrival counts collected at the Sapon Under-bridge Junction across all junction directions, separately for peak and off-peak periods.",
  },
  {
    title: "Statistical calibration",
    description:
      "Fit collected arrival data to an appropriate statistical distribution and use the derived parameters to calibrate a multi-phase SUMO microscopic simulation of the junction.",
  },
  {
    title: "Sequence generation and phase-recommendation model",
    description:
      "Generate labelled time-series traffic-state sequences from the calibrated simulation and train a lightweight Transformer Encoder that recommends a signal phase from a window of observed traffic state.",
  },
  {
    title: "Rule-based priority scheduler",
    description:
      "Validate every model recommendation against deterministic operational rules before applying it.",
  },
  {
    title: "Real-time dashboard",
    description:
      "Visualize current junction state, the active signal phase, priority/pre-emption events, and the model's recommendation alongside the scheduler's actual decision.",
  },
  {
    title: "Evaluation against a fixed-time baseline",
    description:
      "Evaluate the intelligent controller against a fixed-time baseline on identical simulation scenarios: average waiting time, queue length, throughput, and priority-vehicle response time.",
  },
];

const PIPELINE_STAGES: { title: string; description: string }[] = [
  {
    title: "Field data collection",
    description:
      "Manual/observed vehicle counts at the Sapon Under-bridge Junction, per direction, across peak and off-peak sessions.",
  },
  {
    title: "Distribution fitting",
    description:
      "scipy.stats fits an arrival distribution family and parameters (e.g. Poisson, or negative binomial if over-dispersed) with goodness-of-fit results.",
  },
  {
    title: "SUMO calibration",
    description:
      "Junction geometry authored in netedit, combined with fitted parameters, produces a calibrated multi-phase SUMO scenario (.net.xml / .rou.xml / .sumocfg).",
  },
  {
    title: "Sequence generation",
    description:
      "TraCI-driven simulation runs produce labelled time-series traffic-state sequences (counts, queue, waiting time, emergency flags, phase, elapsed phase time).",
  },
  {
    title: "Model training",
    description:
      "PyTorch trains a lightweight Transformer Encoder that maps a window of traffic state to a recommended signal phase.",
  },
  {
    title: "Runtime control loop",
    description:
      "The live loop driving the simulated junction: observe state, check for emergencies, get the model's recommendation, validate it against safety rules, apply, and log.",
  },
  {
    title: "Evaluation vs. fixed-time baseline",
    description:
      "The same calibrated scenarios run once under the runtime control loop and once under a fixed-time baseline controller, then compared.",
  },
  {
    title: "Dashboard",
    description:
      "A Next.js SPA built with Shadcn UI renders live junction state and evaluation results, reading snapshots and telemetry from the internal FastAPI relay under /api/*.",
  },
];

const SCHEDULER_RULES: string[] = [
  "Minimum green time: a phase cannot end before its minimum duration elapses.",
  "Maximum green time: a phase cannot run indefinitely even under sustained demand.",
  "Transition intervals: yellow and all-red clearance intervals are enforced between any two conflicting phases.",
  "Anti-starvation: a direction that has waited longer than a defined threshold forces a phase change, regardless of the model's recommendation.",
  "Emergency vehicle pre-emption: a detected emergency vehicle immediately and safely overrides normal control to grant it right of way, then returns to normal control.",
];

const REASON_CODES: SchedulerReasonCode[] = [
  "model_accepted",
  "min_green_hold",
  "max_green_force",
  "anti_starvation_force",
  "emergency_preempt",
];

const NON_GOALS: string[] = [
  "No physical hardware integration: MaHanya controls a SUMO simulation, not a real traffic signal controller or physical sensors.",
  "No multi-junction, network-wide optimization: scope is a single junction (the Sapon Under-bridge Junction, Abeokuta, as the calibration case study).",
  "No production or city-wide deployment: this is a simulation-based academic prototype, evaluated against a fixed-time baseline on simulated scenarios, not a system intended to go live on a real road.",
  "No general-purpose traffic-engineering platform: features are scoped to what the stated objectives require, not extended for hypothetical future junctions or use cases.",
];

const REFERENCES: string[] = [
  "Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, L., & Polosukhin, I. (2017). Attention is all you need. Advances in Neural Information Processing Systems, 30, 5998-6008.",
  "Lopez, P. A., Behrisch, M., Bieker-Walz, L., Erdmann, J., Flötteröd, Y. P., Hilbrich, R., Lücken, L., Rummel, J., Wagner, P., & Wießner, E. (2018). Microscopic traffic simulation using SUMO. In 2018 21st International Conference on Intelligent Transportation Systems (ITSC) (pp. 2575-2582). IEEE.",
  "Zhao, R., Hu, H., Li, Y., Fan, Y., Gao, F., & Gao, Z. (2024). Sequence decision transformer for adaptive traffic signal control. Sensors, 24(19), 6202.",
  "Abdulhai, B., Pringle, R., & Karakoulas, G. J. (2003). Reinforcement learning for true adaptive traffic signal control. Journal of Transportation Engineering, 129(3), 278-285.",
];

function SectionHeading({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Methodology"
        description="What MaHanya is, why it exists, and how it works: an Ahmadu Bello University final-year project."
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPinIcon className="size-4 text-muted-foreground" />
            <CardTitle className="font-heading text-base font-semibold">
              Aim & problem statement
            </CardTitle>
          </div>
          <CardDescription>
            Sapon Under-bridge Junction, Abeokuta
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
          <p>
            Fixed-time traffic signal systems allocate green time on a
            predetermined schedule, regardless of real-time demand. At
            multi-direction road junctions, including those in growing Nigerian
            cities such as Zaria, Kaduna, and Abuja, this produces unnecessary
            vehicle delay on heavily loaded approaches while green time is
            wasted on lightly loaded ones, no systematic mechanism for
            prioritizing emergency vehicles, and accumulating queue imbalances
            during peak periods.
          </p>
          <p>
            Changing physical infrastructure to address this is expensive and
            impractical for an academic project. MaHanya instead takes a
            simulation-based approach: a microscopic SUMO simulation of the
            Sapon Under-bridge Junction, calibrated with real traffic-count
            data, combined with a rule-guided scheduler, to study intelligent
            signal control within a final-year project's scope.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <SectionHeading icon={TargetIcon} title="Objectives" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {OBJECTIVES.map((objective, index) => (
            <Card key={objective.title} size="sm">
              <CardHeader>
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-sm font-semibold text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <CardTitle className="font-heading text-sm font-semibold">
                    {objective.title}
                  </CardTitle>
                </div>
                <CardDescription>{objective.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading icon={FlowArrowIcon} title="Pipeline" />
        <Card>
          <CardContent className="flex flex-col">
            {PIPELINE_STAGES.map((stage, index) => (
              <div key={stage.title}>
                {index > 0 && <Separator className="my-3" />}
                <div className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-foreground">
                      {stage.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {stage.description}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading icon={ShieldCheckIcon} title="Safety framing" />
        <Alert>
          <GavelIcon />
          <AlertTitle>
            The model is advisory only: the scheduler is the sole authority
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p>
              The transformer model's output is a recommendation, nothing more.
              Every recommendation is validated against deterministic
              operational rules before any signal state is applied, and every
              decision, whether it accepts, holds, or overrides the model, is
              logged with an explicit reason code. This holds regardless of what
              the model recommends.
            </p>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-foreground">
                Scheduler rules
              </span>
              <ul className="ml-4 list-disc space-y-1">
                {SCHEDULER_RULES.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-foreground">Reason codes</span>
              <div className="flex flex-wrap gap-1.5">
                {REASON_CODES.map((code) => (
                  <Badge key={code} variant="outline" className="font-mono">
                    {code}
                  </Badge>
                ))}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading icon={ProhibitIcon} title="Scope & non-goals" />
        <Card>
          <CardContent>
            <ul className="ml-4 list-disc space-y-2 text-xs text-muted-foreground">
              {NON_GOALS.map((goal) => (
                <li key={goal}>{goal}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading icon={BookOpenIcon} title="References" />
        <Card>
          <CardContent>
            <ol className="ml-4 list-decimal space-y-2 text-xs text-muted-foreground">
              {REFERENCES.map((reference) => (
                <li key={reference}>{reference}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
