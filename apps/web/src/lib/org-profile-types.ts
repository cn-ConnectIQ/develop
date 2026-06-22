import type { AccountType } from "@connectiq/database";

export type OrgProfileData = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  website: string | null;
  contactEmail: string | null;
  industry: string | null;
  companySize: string | null;
  headquarters: string | null;
  foundedYear: number | null;
  accountType: AccountType;
  orgCreditCode: string | null;
  isVerified: boolean;
  memberCount: number;
  eventCount: number;
  followerCount: number;
};
