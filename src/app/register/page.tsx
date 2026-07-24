import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { RegisterForm } from "@/app/register/RegisterForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Register",
  description: "Register your team for MMRC 26.",
};

export default async function RegisterPage() {
  const config = await prisma.registerFormConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        Register your team
      </h1>
      <p className="mt-2 text-sm text-ras-gray dark:text-white/70">{config.deadlineText}</p>
      <div className="mt-8">
        {config.isOpen ? (
          <RegisterForm feeInfoText={config.feeInfoText} />
        ) : (
          <div
            role="status"
            className="rounded-md border border-ras-gray/20 bg-ras-gray/5 p-6 text-sm text-ras-gray dark:text-white/70"
          >
            Registration is currently closed. Check back soon, or contact the organizing committee for more
            information.
          </div>
        )}
      </div>
    </div>
  );
}
