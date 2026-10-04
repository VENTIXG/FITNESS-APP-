"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Segmented } from "@/components/ui/controls";
import { useLocale } from "@/components/providers/i18n-provider";
import type { Locale } from "@/lib/domain";
import { setGuestLocale } from "@/server/actions/auth";

export function GuestLocaleSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <Segmented<Locale>
      size="sm"
      ariaLabel="Language"
      value={locale}
      options={[
        { value: "en", label: "English" },
        { value: "el", label: "Ελληνικά" },
      ]}
      onChange={(v) =>
        startTransition(async () => {
          await setGuestLocale(v);
          router.refresh();
        })
      }
    />
  );
}
