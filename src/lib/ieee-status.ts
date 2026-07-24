// Split out from registration.ts so client components (RegisterForm.tsx) can
// import this constant without pulling in registration.ts's server-only
// dependency chain (prisma, email sending, env vars) into the browser bundle.
export type IeeeStatus = "IEEE_RAS_MEMBER" | "IEEE_MEMBER" | "NON_MEMBER";

export const IEEE_STATUS_OPTIONS: { value: IeeeStatus; label: string }[] = [
  { value: "IEEE_RAS_MEMBER", label: "IEEE Robotics and Automation Society (RAS) Member" },
  { value: "IEEE_MEMBER", label: "IEEE Member" },
  { value: "NON_MEMBER", label: "Non-Member" },
];
