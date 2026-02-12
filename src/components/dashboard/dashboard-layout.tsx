"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import type { UserRole } from "@/types/enums";

type DashboardLayoutProps = {
  children: React.ReactNode;
  userRole: UserRole;
  userName: string;
};

export function DashboardLayout({
  children,
  userRole,
  userName,
}: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-dvh bg-navy overflow-hidden">
      <Sidebar
        userRole={userRole}
        userName={userName}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
