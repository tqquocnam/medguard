import { AsyncLocalStorage } from "node:async_hooks";

export interface BranchContext {
  branchId: string;
  userId: string;
}

const contexts = new AsyncLocalStorage<BranchContext>();

export function withBranch<T>(context: BranchContext, action: () => T): T {
  if (!/^\d{5}$/.test(context.branchId)) {
    throw new Error("Chi nhánh của tài khoản không hợp lệ.");
  }
  return contexts.run(Object.freeze({ ...context }), action);
}

export function currentBranch(): string | null {
  return contexts.getStore()?.branchId ?? null;
}

export function requireBranch(): string {
  const branchId = currentBranch();
  if (!branchId) throw new Error("Chưa xác định chi nhánh.");
  return branchId;
}
