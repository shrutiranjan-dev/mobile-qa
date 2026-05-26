import { RuntimeJob } from "@mrp/shared-types";

export class JobStore {
  private readonly jobs = new Map<string, RuntimeJob>();

  create(job: RuntimeJob) {
    this.jobs.set(job.id, job);
    return job;
  }

  update(id: string, patch: Partial<RuntimeJob>) {
    const current = this.jobs.get(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    this.jobs.set(id, next);
    return next;
  }

  get(id: string) {
    return this.jobs.get(id) || null;
  }
}