import Link from "next/link";
import { EvaluationForm } from "@/components/EvaluationForm";
import { shanghaiToday } from "@/lib/dates";

export default function NewEvaluation({
  searchParams,
}: {
  searchParams: { code?: string; name?: string };
}) {
  const today = shanghaiToday();

  return (
    <div className="min-h-screen bg-stone-50 px-6 py-8 text-stone-800">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3 border-b border-stone-200 pb-3.5">
          <Link href="/" className="text-sm text-stone-400 hover:text-stone-600">
            ← 观察池
          </Link>
          <span className="text-base font-medium">新建评估</span>
        </div>

        <div className="mt-6">
          <EvaluationForm
            defaultCode={searchParams.code ?? ""}
            defaultName={searchParams.name ?? ""}
            today={today}
          />
        </div>
      </div>
    </div>
  );
}
