import type { Metadata } from "next";
import { RegisterForm } from "@/app/register/RegisterForm";

export const metadata: Metadata = {
  title: "Register",
  description: "Register your team for MMRC 26.",
};

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-display text-3xl font-extrabold text-ras-purple dark:text-white">
        Register your team
      </h1>
      <p className="mt-2 text-sm text-ras-gray dark:text-white/70">
        Registration is free and takes about a minute.
      </p>
      <div className="mt-8">
        <RegisterForm />
      </div>
    </div>
  );
}
