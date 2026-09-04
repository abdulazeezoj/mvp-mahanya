"use client";

import {
  CaretDownIcon,
  CaretUpIcon,
  ClipboardTextIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SchedulerDecision } from "@/lib/types";

/**
 * Severity hierarchy, calmest to loudest: `model_accepted` is the routine,
 * expected case (outline). `min_green_hold`/`max_green_force` are routine
 * mechanical holds enforcing timing constraints (secondary).
 * `anti_starvation_force` is a notable override worth noticing (primary).
 * `emergency_preempt` is the most safety-critical override in the system;
 * it must be unmistakable in a scrolling log (destructive).
 */
const REASON_VARIANT: Record<
  SchedulerDecision["reasonCode"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  model_accepted: "outline",
  min_green_hold: "secondary",
  max_green_force: "secondary",
  anti_starvation_force: "default",
  emergency_preempt: "destructive",
};

const REASON_OPTIONS: SchedulerDecision["reasonCode"][] = [
  "model_accepted",
  "min_green_hold",
  "max_green_force",
  "anti_starvation_force",
  "emergency_preempt",
];

const columns: ColumnDef<SchedulerDecision>[] = [
  {
    accessorKey: "tick",
    header: "Tick",
  },
  {
    accessorKey: "timestamp",
    header: "Time",
    cell: ({ row }) =>
      new Date(row.original.timestamp).toLocaleTimeString("en-US"),
  },
  {
    id: "recommendedPhase",
    accessorFn: (row) => row.recommendation?.recommendedPhase ?? "-",
    header: "Model Recommendation",
  },
  {
    accessorKey: "appliedPhase",
    header: "Applied Phase",
  },
  {
    accessorKey: "reasonCode",
    header: "Reason",
    cell: ({ row }) => {
      const reasonCode = row.original.reasonCode;
      return (
        <Badge variant={REASON_VARIANT[reasonCode]}>
          {reasonCode === "emergency_preempt" && (
            <WarningOctagonIcon weight="fill" />
          )}
          {reasonCode}
        </Badge>
      );
    },
  },
];

export function DecisionLogTable({
  decisions,
}: {
  decisions: SchedulerDecision[];
}) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "tick", desc: true },
  ]);
  const [reasonFilter, setReasonFilter] = React.useState<string>("all");

  const filteredDecisions = React.useMemo(
    () =>
      reasonFilter === "all"
        ? decisions
        : decisions.filter((decision) => decision.reasonCode === reasonFilter),
    [decisions, reasonFilter],
  );

  const table = useReactTable({
    data: filteredDecisions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (decisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-16 text-center">
        <ClipboardTextIcon className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No decisions yet</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Scheduler decisions will appear here once the scenario is running.
        </p>
      </div>
    );
  }

  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Select
          value={reasonFilter}
          onValueChange={(value) => value && setReasonFilter(value)}
        >
          <SelectTrigger
            className="w-56"
            size="sm"
            aria-label="Filter by reason code"
          >
            <SelectValue placeholder="Filter by reason" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reason codes</SelectItem>
            {REASON_OPTIONS.map((reason) => (
              <SelectItem key={reason} value={reason}>
                {reason}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="max-h-[32rem] overflow-y-auto rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="flex items-center gap-1"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getIsSorted() === "asc" && (
                          <CaretUpIcon className="size-3" />
                        )}
                        {header.column.getIsSorted() === "desc" && (
                          <CaretDownIcon className="size-3" />
                        )}
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="[&>tr:nth-child(even)]:bg-muted/30">
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No decisions match this filter.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
