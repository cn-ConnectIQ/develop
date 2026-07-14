export class OrganizerSignupError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export type OrganizerSignupInput = {
  phone: string;
  code: string;
  companyName: string;
  contactName?: string;
  signupSource?: string;
};

export function organizerSignupLoginKey(token: string) {
  return `organizer-signup-login:${token}`;
}

/**
 * @deprecated 免审 TRIAL 旁路已关闭。请走正式申请 `/register/admin` 或 Demo 体验 `/signup/experience`。
 */
export async function createOrganizerTrialSignup(_input: OrganizerSignupInput) {
  throw new OrganizerSignupError(
    "自助试用通道已关闭。请使用正式组织申请，或加入 Demo 展会体验后等待平台审核转正。",
    "TRIAL_SIGNUP_DISABLED",
  );
}
