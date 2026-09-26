"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useApi } from "@/lib/use-api";
import { fullName } from "@/lib/format";
import type { Employee, TrainingOverview } from "@/lib/types";
import { Alert, PageHeader, Spinner } from "@/components/ui";
import { TrainingOverviewView } from "@/components/training";

// One person's training, for HR and their manager.
export default function PersonTrainingPage() {
  const { id } = useParams<{ id: string }>();
  const data = useApi<TrainingOverview>(`/training/employees/${id}`);
  const person = useApi<Employee>(`/employees/${id}`);
  if (data.loading && !data.data) return <Spinner />;
  if (data.error) return <Alert>{data.error}</Alert>;
  if (!data.data) return null;
  return (
    <>
      <Link href="/training" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> Training
      </Link>
      <PageHeader title={person.data ? `${fullName(person.data)} — training` : "Training"} description={person.data?.designation} />
      <TrainingOverviewView data={data.data} onChange={data.reload} self={data.data.canGiveFeedback} />
    </>
  );
}
