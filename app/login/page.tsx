"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  useEffect(() => {
    // Directly open the main platform
    router.replace("/fund");
  }, [router]);
  return null;
}
