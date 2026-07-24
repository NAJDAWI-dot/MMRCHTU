import type { Metadata } from "next";
import { LoginForm } from "@/app/admin/login/LoginForm";

export const metadata: Metadata = {
  title: "Admin Login",
};

export default function AdminLoginPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-center font-display text-2xl font-extrabold text-ras-purple dark:text-white">
        Admin login
      </h1>
      <div className="mt-8">
        <LoginForm />
      </div>
    </div>
  );
}
