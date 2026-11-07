import { db } from "../config/database.js";

import { createUser } from "../modules/auth/account.service.js";

async function main(): Promise<void> {
  const [branchId, username, ...nameParts] = process.argv.slice(2);

  const password = process.env.MEDGUARD_BOOTSTRAP_PASSWORD;

  delete process.env.MEDGUARD_BOOTSTRAP_PASSWORD;

  if (!branchId || !/^\d{5}$/.test(branchId) || !username || !password) {
    throw new Error("Cần mã chi nhánh, tên đăng nhập và biến MEDGUARD_BOOTSTRAP_PASSWORD.");
  }

  const account = await createUser(branchId, {
    username,
    password,

    fullName: nameParts.join(" ") || `Quản trị chi nhánh ${branchId}`,
  });

  console.log(`Đã tạo tài khoản ${account.username} cho chi nhánh ${account.branch_id}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Không thể tạo tài khoản.");

    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
