"use client";

import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
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
    accessorFn: (row) => row.recommendation?.recommendedPhase ?? "—",
    header: "Model Recommendation",
  },
  {
    accessorKey: "appliedPhase",
    header: "Applied Phase",
  },
  {
    accessorKey: "reasonCode",
    header: "Reason",
    cell: ({ row }) => (
      <Badge variant={REASON_VARIANT[row.original.reasonCode]}>
        {row.original.reasonCode}
      </Badge>
    ),
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
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
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
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
