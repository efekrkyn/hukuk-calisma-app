import { fetchWorker } from "./api";
import type {
  ActivePlanResponse,
  FormInput,
  GenerateResponse,
} from "@/types/plan";

export async function getActivePlan(): Promise<ActivePlanResponse> {
  return fetchWorker<ActivePlanResponse>("/plan/active");
}

export async function generatePlan(form: FormInput): Promise<GenerateResponse> {
  return fetchWorker<GenerateResponse>("/plan/generate", {
    method: "POST",
    body: JSON.stringify({ form }),
  });
}

export async function toggleTask(
  task_uuid: string,
  completed: boolean
): Promise<void> {
  await fetchWorker<void>("/plan/task-toggle", {
    method: "POST",
    body: JSON.stringify({ task_uuid, completed }),
  });
}

export async function addTaskToPlan(date: string, task: any): Promise<any> {
  return fetchWorker<any>("/plan/add-task", {
    method: "POST",
    body: JSON.stringify({ date, task }),
  });
}
