"use client";

import { useQuery } from "@tanstack/react-query";

type ExperienceProfile = {
  isActiveExperience: boolean;
};

async function fetchExperienceProfile(): Promise<ExperienceProfile> {
  const res = await fetch("/api/me/experience-profile");
  if (!res.ok) {
    throw new Error("加载体验账号状态失败");
  }
  const json = await res.json();
  return {
    isActiveExperience: Boolean(json.data?.isActiveExperience),
  };
}

export function useExperienceAccount() {
  return useQuery({
    queryKey: ["experience-profile"],
    queryFn: fetchExperienceProfile,
    staleTime: 5 * 60 * 1000,
  });
}
