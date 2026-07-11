-- CreateSchema


-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLATFORM_ADMIN', 'ORGANIZER', 'EXPO_ORGANIZER', 'EXHIBITOR');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CONFERENCE', 'EXPO');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CONFERENCE', 'EXPO', 'EXHIBITION');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('NATIVE', 'BAGEVENT', 'MARKETUP');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('ATTENDEE', 'SPEAKER');

-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('PARTICIPANT', 'ORGANIZER', 'EXHIBITOR', 'ORGANIZER_STAFF');

-- CreateEnum
CREATE TYPE "ParticipantSource" AS ENUM ('IMPORT', 'INVITE', 'SCAN', 'SELF_REGISTER');

-- CreateEnum
CREATE TYPE "BoothStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'OCCUPIED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'LOST', 'WON');

-- CreateEnum
CREATE TYPE "CrmSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('ISSUED', 'USED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "PollType" AS ENUM ('SINGLE_CHOICE', 'MULTI_CHOICE', 'WORD_CLOUD', 'RATING', 'SURVEY', 'QNA', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('DRAFT', 'LIVE', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AiMatchScenario" AS ENUM ('PARTICIPANT_PEER', 'EXHIBITOR_TO_BUYER', 'BUYER_TO_EXHIBITOR');

-- CreateEnum
CREATE TYPE "AiMatchAction" AS ENUM ('PENDING', 'VIEWED', 'CONTACTED', 'MEETING_BOOKED', 'IGNORED');

-- CreateEnum
CREATE TYPE "AiGenerationType" AS ENUM ('SCAN_BRIEF', 'CONNECTION_NOTE', 'FOLLOWUP_EMAIL', 'INTRO_MESSAGE', 'MONTHLY_INSIGHT', 'INTENT_PARSE');

-- CreateEnum
CREATE TYPE "AiPromptStatus" AS ENUM ('ACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "AiQualityRating" AS ENUM ('EXCELLENT', 'PASS', 'NEEDS_WORK');

-- CreateEnum
CREATE TYPE "MonthlyInsightStatus" AS ENUM ('PENDING', 'GENERATED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiFeedbackType" AS ENUM ('MATCH_USEFUL', 'MATCH_USELESS', 'TIMING_ACCURATE', 'TIMING_INACCURATE', 'CONTENT_QUALITY', 'CONTENT_POOR');

-- CreateEnum
CREATE TYPE "MatchFeedbackSignal" AS ENUM ('EXCHANGED', 'MEETING', 'VIEWED', 'IGNORED', 'DECLINED');

-- CreateEnum
CREATE TYPE "IntentCategory" AS ENUM ('TRADING', 'INVESTING', 'PARTNERING', 'RECRUITING', 'NETWORKING');

-- CreateEnum
CREATE TYPE "IntentTagPool" AS ENUM ('SUPPLY', 'DEMAND', 'TOPIC', 'GENERAL');

-- CreateEnum
CREATE TYPE "SnSessionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UserAccountStatus" AS ENUM ('SHADOW', 'ACTIVE', 'COMPLETE', 'BANNED');

-- CreateEnum
CREATE TYPE "RegistrationSource" AS ENUM ('EMAIL', 'PHONE', 'WECHAT', 'IMPORT');

-- CreateEnum
CREATE TYPE "ConnectionSource" AS ENUM ('SCAN', 'AI_RECOMMEND', 'SPEED_NETWORKING', 'REFERRAL');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "ExchangeMethod" AS ENUM ('FACE_TO_FACE', 'DEFERRED', 'MY_CARD_SCANNED');

-- CreateEnum
CREATE TYPE "ExchangeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PointsReason" AS ENUM ('CHECKIN', 'CONNECTION', 'INTERACTION', 'PROFILE', 'REFERRAL', 'REDEMPTION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "FeedItemType" AS ENUM ('MATCH', 'AI_REFERRAL', 'INSIGHT', 'REMINDER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('BOOTH_SCAN', 'BOOTH_LEAD_CAPTURED', 'POLL_ANSWERED', 'QNA_ASKED', 'QNA_UPVOTED', 'INTERACTION_JOINED', 'CONNECTION_MADE', 'MEETING_BOOKED');

-- CreateEnum
CREATE TYPE "StampRallyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "StampOwnerType" AS ENUM ('ORGANIZER', 'EXHIBITOR');

-- CreateEnum
CREATE TYPE "StampCollectMethod" AS ENUM ('SCAN', 'NFC');

-- CreateEnum
CREATE TYPE "StampPointType" AS ENUM ('BOOTH', 'SPONSOR_AREA', 'SESSION', 'PHOTO_WALL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "InviteCampaignStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'FAILED', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "InviteChannel" AS ENUM ('SMS', 'EMAIL', 'WECHAT');

-- CreateEnum
CREATE TYPE "InviteRecordStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'CLICKED', 'ACTIVATED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ParticipantInviteStatus" AS ENUM ('NOT_INVITED', 'INVITED', 'CLICKED', 'ACTIVATED');

-- CreateEnum
CREATE TYPE "LotteryType" AS ENUM ('RANDOM', 'QUIZ_BASED', 'CHECKIN_BASED', 'ACTIVITY_BASED');

-- CreateEnum
CREATE TYPE "LotteryCategory" AS ENUM ('POOL_DRAW', 'AUTO_PROBABILITY', 'INSTANT_CLAIM');

-- CreateEnum
CREATE TYPE "ScanActionType" AS ENUM ('CHECKIN', 'STAMP', 'LOTTERY_VERIFY', 'GIFT_VERIFY');

-- CreateEnum
CREATE TYPE "ScanResult" AS ENUM ('SUCCESS', 'DUPLICATE', 'INVALID', 'NO_PERMISSION');

-- CreateEnum
CREATE TYPE "AnimationType" AS ENUM ('WHEEL', 'GRID', 'SLOT', 'SPOTLIGHT', 'PACHINKO', 'GIFT_RAIN');

-- CreateEnum
CREATE TYPE "BigScreenAnimationType" AS ENUM ('ROLLING_MACHINE', 'SPOTLIGHT_SCROLL', 'REEL_OF_HONOR', 'STARLIGHT_ORBIT', 'PRECISION_ROLLER', 'SCROLL_UNVEILING');

-- CreateEnum
CREATE TYPE "TriggerAction" AS ENUM ('FILL_FORM', 'SURVEY', 'SCAN_ONLY');

-- CreateEnum
CREATE TYPE "LotteryOwnerType" AS ENUM ('ORGANIZER', 'EXHIBITOR');

-- CreateEnum
CREATE TYPE "LotteryDrawType" AS ENUM ('INSTANT', 'SCHEDULED', 'MANUAL');

-- CreateEnum
CREATE TYPE "LotteryStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DRAWING', 'ENDED', 'READY', 'OPEN', 'FINISHED');

-- CreateEnum
CREATE TYPE "PrizeType" AS ENUM ('PHYSICAL', 'DIGITAL', 'EXPERIENCE');

-- CreateEnum
CREATE TYPE "LotteryEntrySource" AS ENUM ('MANUAL', 'AUTO_CHECKIN', 'AUTO_ACTIVITY');

-- CreateEnum
CREATE TYPE "InteractionChannelType" AS ENUM ('QR_CODE', 'LINK', 'APP_PUSH');

-- CreateEnum
CREATE TYPE "InteractionOwnerType" AS ENUM ('ORGANIZER', 'EXHIBITOR');

-- CreateEnum
CREATE TYPE "PairingStatus" AS ENUM ('WAITING', 'PAIRED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('POLL', 'LOTTERY', 'QA');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('END_USER', 'ACCOUNT_ADMIN', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('PENDING_REVIEW', 'TRIAL', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ORGANIZATION', 'CONFERENCE_ORGANIZER', 'EXPO_ORGANIZER', 'EXHIBITOR');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "EventReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED');

-- CreateEnum
CREATE TYPE "OrgJoinSource" AS ENUM ('PARTICIPATED_EVENT', 'LEAD_CAPTURED', 'INVITED', 'FOLLOWED', 'QR_SCANNED');

-- CreateEnum
CREATE TYPE "MemberTier" AS ENUM ('VIP', 'ACTIVE', 'REGULAR', 'DORMANT');

-- CreateEnum
CREATE TYPE "OrgStaffRole" AS ENUM ('OWNER', 'ADMIN', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'REVOKED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_type" "UserType" NOT NULL DEFAULT 'END_USER',
    "org_id" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "cover_url" TEXT,
    "bio" TEXT,
    "website" TEXT,
    "contact_email" TEXT,
    "industry" TEXT,
    "company_size" TEXT,
    "headquarters" TEXT,
    "founded_year" INTEGER,
    "account_type" "AccountType",
    "org_credit_code" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "admin_status" "AdminStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "total_events" INTEGER NOT NULL DEFAULT 0,
    "total_participants" INTEGER NOT NULL DEFAULT 0,
    "total_leads" INTEGER NOT NULL DEFAULT 0,
    "total_connections" INTEGER NOT NULL DEFAULT 0,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "event_count" INTEGER NOT NULL DEFAULT 0,
    "follower_count" INTEGER NOT NULL DEFAULT 0,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_members" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "join_source" "OrgJoinSource" NOT NULL,
    "source_event_id" TEXT,
    "is_following" BOOLEAN NOT NULL DEFAULT false,
    "is_subscribed" BOOLEAN NOT NULL DEFAULT false,
    "tier" "MemberTier" NOT NULL DEFAULT 'REGULAR',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "event_count" INTEGER NOT NULL DEFAULT 0,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_staff" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "OrgStaffRole" NOT NULL,
    "invited_by" TEXT,
    "status" "InviteStatus" NOT NULL DEFAULT 'INVITED',
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizer_trial_profiles" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "signup_source" TEXT NOT NULL DEFAULT 'self_service_organizer',
    "company_name" TEXT NOT NULL,
    "contact_name" TEXT,
    "trial_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "events_created" INTEGER NOT NULL DEFAULT 0,
    "events_published" INTEGER NOT NULL DEFAULT 0,
    "participants_imported" INTEGER NOT NULL DEFAULT 0,
    "connections_total" INTEGER NOT NULL DEFAULT 0,
    "leads_total" INTEGER NOT NULL DEFAULT 0,
    "conversion_score" INTEGER NOT NULL DEFAULT 0,
    "first_event_at" TIMESTAMP(3),
    "first_import_at" TIMESTAMP(3),
    "first_published_at" TIMESTAMP(3),
    "first_connection_at" TIMESTAMP(3),
    "conversion_signals" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizer_trial_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_hook_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT,
    "target" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "event_id" TEXT,
    "booth_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversion_hook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizer_applications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT,
    "account_type" "AccountType" NOT NULL,
    "org_name" TEXT NOT NULL,
    "org_credit_code" TEXT,
    "org_website" TEXT,
    "contact_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "reviewer_notes" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizer_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_reviews" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "status" "EventReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "rejection_reason" TEXT,
    "revision_notes" TEXT,
    "reviewer_notes" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "activity_type" "ActivityType" NOT NULL DEFAULT 'CONFERENCE',
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "location" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "organizer_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "data_source" "DataSource" NOT NULL DEFAULT 'NATIVE',
    "external_ref_id" TEXT,
    "feature_flags" JSONB NOT NULL DEFAULT '{}',
    "meeting_enabled" BOOLEAN NOT NULL DEFAULT true,
    "meeting_slot_minutes" INTEGER NOT NULL DEFAULT 20,
    "meeting_open_at" TIMESTAMP(3),
    "meeting_buffer_minutes" INTEGER NOT NULL DEFAULT 5,
    "intent_config" JSONB NOT NULL DEFAULT '{}',
    "premeet_enabled" BOOLEAN NOT NULL DEFAULT false,
    "premeet_open_at" TIMESTAMP(3),
    "show_tags_to_participants" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_syncs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'marketup',
    "field_map" JSONB NOT NULL DEFAULT '{}',
    "sync_config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_integrations" (
    "provider" TEXT NOT NULL,
    "field_map" JSONB NOT NULL DEFAULT '{}',
    "sync_config" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_integrations_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "crm_sync_jobs" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "status" "CrmSyncStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_settings" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expo_halls" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floor" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expo_halls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booths" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "BoothStatus" NOT NULL DEFAULT 'AVAILABLE',
    "event_id" TEXT NOT NULL,
    "hall_id" TEXT,
    "company_org_id" TEXT NOT NULL,
    "operator_user_id" TEXT,
    "position_data" JSONB,
    "position_x" DOUBLE PRECISION,
    "position_y" DOUBLE PRECISION,
    "hall" TEXT,
    "lead_form_config" JSONB,
    "max_staff_count" INTEGER NOT NULL DEFAULT 2,
    "extra_staff_purchased" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booth_bookings" (
    "id" TEXT NOT NULL,
    "booth_id" TEXT NOT NULL,
    "participant_id" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "booked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booth_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "job_title" TEXT,
    "badge_qr" TEXT,
    "role" "ParticipantRole" NOT NULL DEFAULT 'ATTENDEE',
    "system_role" "SystemRole" NOT NULL DEFAULT 'PARTICIPANT',
    "booth_id" TEXT,
    "is_booth_owner" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" "ParticipantSource" NOT NULL DEFAULT 'SCAN',
    "invite_status" "ParticipantInviteStatus" NOT NULL DEFAULT 'NOT_INVITED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_registrations" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "ticket_type_id" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participant_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intent_tags" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "IntentCategory",
    "pool" "IntentTagPool" NOT NULL DEFAULT 'GENERAL',
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intent_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "booth_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "intent_grade" TEXT,
    "notes" TEXT,
    "crm_sync_status" "CrmSyncStatus" NOT NULL DEFAULT 'PENDING',
    "crm_sync_error" TEXT,
    "crm_synced_at" TIMESTAMP(3),
    "marketup_contact_id" TEXT,
    "marketup_lead_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_intent_tags" (
    "lead_id" TEXT NOT NULL,
    "intent_tag_id" TEXT NOT NULL,

    CONSTRAINT "lead_intent_tags_pkey" PRIMARY KEY ("lead_id","intent_tag_id")
);

-- CreateTable
CREATE TABLE "ticket_types" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quota" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "ticket_type_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'ISSUED',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "room" TEXT,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speakers" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "bio" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_speakers" (
    "session_id" TEXT NOT NULL,
    "speaker_id" TEXT NOT NULL,

    CONSTRAINT "session_speakers_pkey" PRIMARY KEY ("session_id","speaker_id")
);

-- CreateTable
CREATE TABLE "sponsors" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" TEXT NOT NULL,
    "uploader_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'manual',
    "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polls" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "type" "PollType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PollStatus" NOT NULL DEFAULT 'DRAFT',
    "show_results" BOOLEAN NOT NULL DEFAULT true,
    "closes_at" TIMESTAMP(3),
    "scheduled_at" TIMESTAMP(3),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_options" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_responses" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "participant_id" TEXT,
    "option_id" TEXT,
    "text_answer" TEXT,
    "rating" INTEGER,
    "is_on_screen" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotteries" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "owner_type" "LotteryOwnerType" NOT NULL DEFAULT 'ORGANIZER',
    "booth_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cover_image" TEXT,
    "draw_type" "LotteryDrawType" NOT NULL DEFAULT 'INSTANT',
    "draw_at" TIMESTAMP(3),
    "status" "LotteryStatus" NOT NULL DEFAULT 'DRAFT',
    "lottery_category" "LotteryCategory" NOT NULL DEFAULT 'AUTO_PROBABILITY',
    "animation_type" "AnimationType",
    "big_screen_animation_type" "BigScreenAnimationType",
    "trigger_action" "TriggerAction",
    "require_lead_capture" BOOLEAN NOT NULL DEFAULT true,
    "lead_form_config" JSONB NOT NULL DEFAULT '[]',
    "max_entries_per_user" INTEGER NOT NULL DEFAULT 1,
    "type" "LotteryType" NOT NULL DEFAULT 'RANDOM',
    "prizes" JSONB NOT NULL DEFAULT '[]',
    "require_checkin" BOOLEAN NOT NULL DEFAULT false,
    "require_poll_id" TEXT,
    "eligible_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quiz_poll_id" TEXT,
    "winner_count" INTEGER NOT NULL DEFAULT 1,
    "allow_reenter" BOOLEAN NOT NULL DEFAULT false,
    "entry_count" INTEGER NOT NULL DEFAULT 0,
    "drawn_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lotteries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lottery_prizes" (
    "id" TEXT NOT NULL,
    "lottery_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "quantity" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "prize_type" "PrizeType" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "tier" INTEGER,
    "probability" DOUBLE PRECISION,

    CONSTRAINT "lottery_prizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lottery_entries" (
    "id" TEXT NOT NULL,
    "lottery_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lead_data" JSONB NOT NULL DEFAULT '{}',
    "lead_id" TEXT,
    "source" "LotteryEntrySource" NOT NULL DEFAULT 'MANUAL',
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lottery_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_event_codes" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_event_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_scan_logs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "code_id" TEXT,
    "action_type" "ScanActionType" NOT NULL,
    "action_ref" TEXT,
    "result" "ScanResult" NOT NULL,
    "operator_id" TEXT NOT NULL,
    "code_hint" TEXT,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_scan_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lottery_winners" (
    "id" TEXT NOT NULL,
    "lottery_id" TEXT NOT NULL,
    "prize_id" TEXT,
    "entry_id" TEXT,
    "event_code_id" TEXT,
    "verification_code" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "won_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "prize_rank" INTEGER NOT NULL DEFAULT 1,
    "prize_name" TEXT NOT NULL DEFAULT '',
    "drawn_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "lottery_winners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interaction_sessions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "owner_type" "InteractionOwnerType" NOT NULL DEFAULT 'ORGANIZER',
    "booth_id" TEXT,
    "exhibitor_org_id" TEXT,
    "created_by" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "session_code" TEXT NOT NULL,
    "qr_url" TEXT,
    "interactions" JSONB NOT NULL DEFAULT '[]',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "channel_type" "InteractionChannelType" NOT NULL DEFAULT 'QR_CODE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "scan_count" INTEGER NOT NULL DEFAULT 0,
    "participant_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interaction_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screen_pairings" (
    "id" TEXT NOT NULL,
    "pairing_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "status" "PairingStatus" NOT NULL DEFAULT 'WAITING',
    "event_id" TEXT,
    "event_name_cache" TEXT,
    "interaction_type" "InteractionType",
    "interaction_id" TEXT,
    "interaction_name" TEXT,
    "paired_by" TEXT,
    "paired_at" TIMESTAMP(3),
    "last_heartbeat_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screen_pairings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_match_results" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "user_a_name" TEXT NOT NULL,
    "user_a_company" TEXT,
    "user_b_name" TEXT NOT NULL,
    "user_b_company" TEXT,
    "score" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "match_reason" JSONB NOT NULL DEFAULT '[]',
    "scenario" "AiMatchScenario" NOT NULL,
    "action" "AiMatchAction" NOT NULL DEFAULT 'PENDING',
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_match_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_event_intents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "supply_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "demand_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "role" TEXT,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "industry" TEXT,
    "region" TEXT,
    "raw_intent_text" TEXT,
    "embedding" TEXT,
    "intent_parsed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_event_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_briefs" (
    "id" TEXT NOT NULL,
    "viewer_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "match_reason" TEXT NOT NULL,
    "match_score" DOUBLE PRECISION NOT NULL,
    "match_dimensions" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_feedbacks" (
    "id" TEXT NOT NULL,
    "viewer_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "signal" "MatchFeedbackSignal" NOT NULL,
    "match_score" DOUBLE PRECISION NOT NULL,
    "match_dimensions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_weight_tunings" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "weights" JSONB NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_weight_tunings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generation_logs" (
    "id" TEXT NOT NULL,
    "type" "AiGenerationType" NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "tokens_used" INTEGER NOT NULL,
    "adopted" BOOLEAN NOT NULL DEFAULT false,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "content_preview" TEXT,
    "quality_rating" "AiQualityRating",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompt_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" "AiGenerationType" NOT NULL,
    "adoption" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "edit_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_tokens" INTEGER NOT NULL DEFAULT 0,
    "status" "AiPromptStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_insights" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "actions" JSONB NOT NULL DEFAULT '[]',
    "viewed" BOOLEAN NOT NULL DEFAULT false,
    "status" "MonthlyInsightStatus" NOT NULL DEFAULT 'PENDING',
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_feedbacks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" "AiFeedbackType" NOT NULL,
    "negative_reason" TEXT,
    "positive" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_feedback_analyses" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "based_on" INTEGER NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_feedback_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" TEXT NOT NULL,
    "company" TEXT,
    "industry" TEXT,
    "value_proposition" TEXT,
    "intentTags" JSONB NOT NULL DEFAULT '[]',
    "account_status" "UserAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "registration_source" "RegistrationSource" NOT NULL DEFAULT 'EMAIL',
    "points_balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_identities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_connections" (
    "id" TEXT NOT NULL,
    "user_a_id" TEXT,
    "user_b_id" TEXT,
    "user_a_name" TEXT NOT NULL,
    "user_a_company" TEXT,
    "user_b_name" TEXT NOT NULL,
    "user_b_company" TEXT,
    "source" "ConnectionSource" NOT NULL,
    "origin_context" TEXT,
    "event_id" TEXT,
    "event_name" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 1,
    "ai_score" INTEGER,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wechat_exchanged" BOOLEAN NOT NULL DEFAULT false,
    "wechat_exchanged_at" TIMESTAMP(3),
    "exchange_method" "ExchangeMethod",
    "booth_id" TEXT,
    "from_ai_match" BOOLEAN NOT NULL DEFAULT false,
    "ai_match_score" DOUBLE PRECISION,

    CONSTRAINT "business_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_referrals" (
    "id" TEXT NOT NULL,
    "introducer_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "user_a_id" TEXT,
    "user_b_id" TEXT,
    "user_a_name" TEXT NOT NULL,
    "user_a_company" TEXT,
    "user_a_title" TEXT,
    "user_b_name" TEXT NOT NULL,
    "user_b_company" TEXT,
    "user_b_title" TEXT,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "ai_confidence" DOUBLE PRECISION,
    "ai_generated_message" TEXT,
    "event_id" TEXT,
    "event_name" TEXT,
    "result_connection_id" TEXT,
    "reminded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'PENDING',
    "scheduled_start" TIMESTAMP(3),
    "scheduled_end" TIMESTAMP(3),
    "table_id" TEXT,
    "message" TEXT,
    "from_ai_match" BOOLEAN NOT NULL DEFAULT false,
    "ai_match_score" DOUBLE PRECISION,
    "wechat_exchanged" BOOLEAN NOT NULL DEFAULT false,
    "requester_rating" INTEGER,
    "recipient_rating" INTEGER,
    "requester_rating_comment" TEXT,
    "recipient_rating_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_areas" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_tables" (
    "id" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection_interactions" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connection_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_cards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "wechat_qr_url" TEXT,
    "wechat_id" TEXT,
    "show_phone" BOOLEAN NOT NULL DEFAULT false,
    "show_email" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "allow_exchange" BOOLEAN NOT NULL DEFAULT true,
    "auto_accept_at_event" BOOLEAN NOT NULL DEFAULT false,
    "headline" TEXT,
    "card_theme" TEXT NOT NULL DEFAULT 'blue',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_requests" (
    "id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "event_id" TEXT,
    "booth_id" TEXT,
    "status" "ExchangeStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "from_ai_match" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "exchange_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_ledger" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "PointsReason" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_redemptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "benefit_name" TEXT NOT NULL,
    "points_spent" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT,
    "type" "FeedItemType" NOT NULL,
    "content" TEXT NOT NULL,
    "ai_score" INTEGER,
    "trigger_reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_referral_scans" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pairs_found" INTEGER NOT NULL DEFAULT 0,
    "feeds_created" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_referral_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booth_visit_signals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "signal_type" "SignalType" NOT NULL,
    "entity_id" TEXT,
    "entity_type" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "inferred_intent" TEXT,
    "intent_confidence" DOUBLE PRECISION,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booth_visit_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sn_sessions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "status" "SnSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "round_count" INTEGER NOT NULL DEFAULT 1,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sn_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sn_pairs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "participant_a_id" TEXT NOT NULL,
    "participant_b_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "rating_a" INTEGER,
    "rating_b" INTEGER,
    "connection_established" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sn_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_campaigns" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "created_by" TEXT,
    "name" TEXT NOT NULL,
    "channel" "InviteChannel" NOT NULL,
    "status" "InviteCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "template_id" TEXT,
    "subject" TEXT,
    "custom_message" TEXT,
    "target_filter" JSONB NOT NULL DEFAULT '{}',
    "total_target" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "clicked_count" INTEGER NOT NULL DEFAULT 0,
    "activated_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invite_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_records" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "channel" "InviteChannel" NOT NULL,
    "destination" TEXT NOT NULL,
    "activation_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "status" "InviteRecordStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "vendor_message_id" TEXT,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invite_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stamp_rallies" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "owner_type" "StampOwnerType" NOT NULL DEFAULT 'ORGANIZER',
    "booth_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cover_image" TEXT,
    "prize" TEXT NOT NULL,
    "prize_image_url" TEXT,
    "prize_desc" TEXT,
    "required_count" INTEGER NOT NULL,
    "total_booths" INTEGER NOT NULL DEFAULT 0,
    "booth_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "status" "StampRallyStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stamp_rallies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stamps" (
    "id" TEXT NOT NULL,
    "rally_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "point_type" "StampPointType" NOT NULL DEFAULT 'BOOTH',
    "booth_id" TEXT,
    "custom_name" TEXT,
    "location" TEXT,
    "icon" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "scan_code" TEXT NOT NULL,
    "nfc_tag_id" TEXT,
    "collect_methods" "StampCollectMethod"[] DEFAULT ARRAY['SCAN']::"StampCollectMethod"[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stamps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stamps" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stamp_id" TEXT NOT NULL,
    "collect_method" "StampCollectMethod" NOT NULL DEFAULT 'SCAN',
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_by" TEXT,

    CONSTRAINT "user_stamps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stamp_progresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rally_id" TEXT NOT NULL,
    "collected_count" INTEGER NOT NULL DEFAULT 0,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "redeemed" BOOLEAN NOT NULL DEFAULT false,
    "redeemed_at" TIMESTAMP(3),
    "redemption_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_stamp_progresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stamp_records" (
    "id" TEXT NOT NULL,
    "rally_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "booth_id" TEXT NOT NULL,
    "stamped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stamp_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stamp_rally_winners" (
    "id" TEXT NOT NULL,
    "rally_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "stamp_rally_winners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_assignments_user_id_role_entity_id_key" ON "user_role_assignments"("user_id", "role", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_owner_id_key" ON "organizations"("owner_id");

-- CreateIndex
CREATE INDEX "organizations_admin_status_idx" ON "organizations"("admin_status");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "org_members_org_id_tier_idx" ON "org_members"("org_id", "tier");

-- CreateIndex
CREATE INDEX "org_members_org_id_last_active_at_idx" ON "org_members"("org_id", "last_active_at");

-- CreateIndex
CREATE INDEX "org_members_org_id_is_following_idx" ON "org_members"("org_id", "is_following");

-- CreateIndex
CREATE UNIQUE INDEX "org_members_org_id_user_id_key" ON "org_members"("org_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_staff_org_id_user_id_key" ON "org_staff"("org_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizer_trial_profiles_org_id_key" ON "organizer_trial_profiles"("org_id");

-- CreateIndex
CREATE INDEX "organizer_trial_profiles_user_id_idx" ON "organizer_trial_profiles"("user_id");

-- CreateIndex
CREATE INDEX "organizer_trial_profiles_trial_started_at_idx" ON "organizer_trial_profiles"("trial_started_at");

-- CreateIndex
CREATE INDEX "conversion_hook_events_target_context_action_created_at_idx" ON "conversion_hook_events"("target", "context", "action", "created_at");

-- CreateIndex
CREATE INDEX "conversion_hook_events_user_id_target_context_trigger_idx" ON "conversion_hook_events"("user_id", "target", "context", "trigger");

-- CreateIndex
CREATE INDEX "conversion_hook_events_org_id_created_at_idx" ON "conversion_hook_events"("org_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "organizer_applications_org_id_key" ON "organizer_applications"("org_id");

-- CreateIndex
CREATE INDEX "organizer_applications_user_id_idx" ON "organizer_applications"("user_id");

-- CreateIndex
CREATE INDEX "organizer_applications_status_idx" ON "organizer_applications"("status");

-- CreateIndex
CREATE INDEX "organizer_applications_account_type_status_idx" ON "organizer_applications"("account_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "event_reviews_event_id_key" ON "event_reviews"("event_id");

-- CreateIndex
CREATE INDEX "event_reviews_status_idx" ON "event_reviews"("status");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "announcements_event_id_is_pinned_published_at_idx" ON "announcements"("event_id", "is_pinned", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "external_syncs_event_id_provider_key" ON "external_syncs"("event_id", "provider");

-- CreateIndex
CREATE INDEX "crm_sync_jobs_status_created_at_idx" ON "crm_sync_jobs"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_settings_event_id_key_key" ON "event_settings"("event_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "booths_event_id_code_key" ON "booths"("event_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "participants_badge_qr_key" ON "participants"("badge_qr");

-- CreateIndex
CREATE INDEX "participants_event_id_phone_idx" ON "participants"("event_id", "phone");

-- CreateIndex
CREATE INDEX "participants_booth_id_idx" ON "participants"("booth_id");

-- CreateIndex
CREATE UNIQUE INDEX "intent_tags_event_id_slug_key" ON "intent_tags"("event_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_code_key" ON "tickets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_event_id_participant_id_key" ON "check_ins"("event_id", "participant_id");

-- CreateIndex
CREATE INDEX "lotteries_event_id_status_idx" ON "lotteries"("event_id", "status");

-- CreateIndex
CREATE INDEX "lotteries_booth_id_idx" ON "lotteries"("booth_id");

-- CreateIndex
CREATE INDEX "lottery_prizes_lottery_id_idx" ON "lottery_prizes"("lottery_id");

-- CreateIndex
CREATE INDEX "lottery_entries_lottery_id_idx" ON "lottery_entries"("lottery_id");

-- CreateIndex
CREATE UNIQUE INDEX "lottery_entries_lottery_id_user_id_key" ON "lottery_entries"("lottery_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_event_codes_code_key" ON "user_event_codes"("code");

-- CreateIndex
CREATE INDEX "user_event_codes_event_id_idx" ON "user_event_codes"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_event_codes_event_id_user_id_key" ON "user_event_codes"("event_id", "user_id");

-- CreateIndex
CREATE INDEX "code_scan_logs_code_id_action_type_idx" ON "code_scan_logs"("code_id", "action_type");

-- CreateIndex
CREATE INDEX "code_scan_logs_operator_id_scanned_at_idx" ON "code_scan_logs"("operator_id", "scanned_at");

-- CreateIndex
CREATE INDEX "code_scan_logs_event_id_scanned_at_idx" ON "code_scan_logs"("event_id", "scanned_at");

-- CreateIndex
CREATE UNIQUE INDEX "lottery_winners_entry_id_key" ON "lottery_winners"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "lottery_winners_verification_code_key" ON "lottery_winners"("verification_code");

-- CreateIndex
CREATE INDEX "lottery_winners_lottery_id_idx" ON "lottery_winners"("lottery_id");

-- CreateIndex
CREATE INDEX "lottery_winners_prize_id_idx" ON "lottery_winners"("prize_id");

-- CreateIndex
CREATE INDEX "lottery_winners_event_code_id_idx" ON "lottery_winners"("event_code_id");

-- CreateIndex
CREATE UNIQUE INDEX "interaction_sessions_session_code_key" ON "interaction_sessions"("session_code");

-- CreateIndex
CREATE INDEX "interaction_sessions_event_id_idx" ON "interaction_sessions"("event_id");

-- CreateIndex
CREATE INDEX "interaction_sessions_booth_id_idx" ON "interaction_sessions"("booth_id");

-- CreateIndex
CREATE INDEX "interaction_sessions_session_code_idx" ON "interaction_sessions"("session_code");

-- CreateIndex
CREATE UNIQUE INDEX "screen_pairings_pairing_token_key" ON "screen_pairings"("pairing_token");

-- CreateIndex
CREATE INDEX "screen_pairings_status_token_expires_at_idx" ON "screen_pairings"("status", "token_expires_at");

-- CreateIndex
CREATE INDEX "screen_pairings_event_id_interaction_id_idx" ON "screen_pairings"("event_id", "interaction_id");

-- CreateIndex
CREATE INDEX "screen_pairings_interaction_id_status_idx" ON "screen_pairings"("interaction_id", "status");

-- CreateIndex
CREATE INDEX "user_event_intents_event_id_intent_parsed_at_idx" ON "user_event_intents"("event_id", "intent_parsed_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_event_intents_user_id_event_id_key" ON "user_event_intents"("user_id", "event_id");

-- CreateIndex
CREATE INDEX "match_briefs_event_id_generated_at_idx" ON "match_briefs"("event_id", "generated_at");

-- CreateIndex
CREATE UNIQUE INDEX "match_briefs_viewer_id_target_id_event_id_key" ON "match_briefs"("viewer_id", "target_id", "event_id");

-- CreateIndex
CREATE INDEX "match_feedbacks_event_id_signal_created_at_idx" ON "match_feedbacks"("event_id", "signal", "created_at");

-- CreateIndex
CREATE INDEX "match_feedbacks_viewer_id_target_id_event_id_created_at_idx" ON "match_feedbacks"("viewer_id", "target_id", "event_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "match_weight_tunings_event_id_key" ON "match_weight_tunings"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompt_versions_version_type_key" ON "ai_prompt_versions"("version", "type");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_insights_user_id_period_key" ON "monthly_insights"("user_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_user_id_provider_key" ON "user_identities"("user_id", "provider");

-- CreateIndex
CREATE INDEX "business_connections_event_id_wechat_exchanged_idx" ON "business_connections"("event_id", "wechat_exchanged");

-- CreateIndex
CREATE INDEX "business_connections_booth_id_idx" ON "business_connections"("booth_id");

-- CreateIndex
CREATE INDEX "meetings_event_id_status_idx" ON "meetings"("event_id", "status");

-- CreateIndex
CREATE INDEX "meetings_requester_id_idx" ON "meetings"("requester_id");

-- CreateIndex
CREATE INDEX "meetings_recipient_id_idx" ON "meetings"("recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_cards_user_id_key" ON "contact_cards"("user_id");

-- CreateIndex
CREATE INDEX "exchange_requests_to_user_id_status_idx" ON "exchange_requests"("to_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_requests_from_user_id_to_user_id_event_id_key" ON "exchange_requests"("from_user_id", "to_user_id", "event_id");

-- CreateIndex
CREATE INDEX "feed_items_event_id_idx" ON "feed_items"("event_id");

-- CreateIndex
CREATE INDEX "ai_referral_scans_event_id_idx" ON "ai_referral_scans"("event_id");

-- CreateIndex
CREATE INDEX "booth_visit_signals_user_id_event_id_idx" ON "booth_visit_signals"("user_id", "event_id");

-- CreateIndex
CREATE INDEX "booth_visit_signals_event_id_signal_type_idx" ON "booth_visit_signals"("event_id", "signal_type");

-- CreateIndex
CREATE INDEX "booth_visit_signals_occurred_at_idx" ON "booth_visit_signals"("occurred_at");

-- CreateIndex
CREATE INDEX "invite_campaigns_event_id_status_idx" ON "invite_campaigns"("event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invite_records_activation_token_key" ON "invite_records"("activation_token");

-- CreateIndex
CREATE INDEX "invite_records_campaign_id_status_idx" ON "invite_records"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "invite_records_activation_token_idx" ON "invite_records"("activation_token");

-- CreateIndex
CREATE UNIQUE INDEX "invite_records_campaign_id_participant_id_key" ON "invite_records"("campaign_id", "participant_id");

-- CreateIndex
CREATE INDEX "stamp_rallies_event_id_status_idx" ON "stamp_rallies"("event_id", "status");

-- CreateIndex
CREATE INDEX "stamp_rallies_booth_id_idx" ON "stamp_rallies"("booth_id");

-- CreateIndex
CREATE UNIQUE INDEX "stamps_scan_code_key" ON "stamps"("scan_code");

-- CreateIndex
CREATE UNIQUE INDEX "stamps_nfc_tag_id_key" ON "stamps"("nfc_tag_id");

-- CreateIndex
CREATE INDEX "stamps_rally_id_idx" ON "stamps"("rally_id");

-- CreateIndex
CREATE INDEX "stamps_booth_id_idx" ON "stamps"("booth_id");

-- CreateIndex
CREATE INDEX "stamps_rally_id_point_type_idx" ON "stamps"("rally_id", "point_type");

-- CreateIndex
CREATE INDEX "user_stamps_user_id_idx" ON "user_stamps"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_stamps_user_id_stamp_id_key" ON "user_stamps"("user_id", "stamp_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_stamp_progresses_redemption_code_key" ON "user_stamp_progresses"("redemption_code");

-- CreateIndex
CREATE INDEX "user_stamp_progresses_rally_id_idx" ON "user_stamp_progresses"("rally_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_stamp_progresses_user_id_rally_id_key" ON "user_stamp_progresses"("user_id", "rally_id");

-- CreateIndex
CREATE INDEX "stamp_records_rally_id_user_id_idx" ON "stamp_records"("rally_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "stamp_records_rally_id_user_id_booth_id_key" ON "stamp_records"("rally_id", "user_id", "booth_id");

-- CreateIndex
CREATE UNIQUE INDEX "stamp_rally_winners_rally_id_user_id_key" ON "stamp_rally_winners"("rally_id", "user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_source_event_id_fkey" FOREIGN KEY ("source_event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_staff" ADD CONSTRAINT "org_staff_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_staff" ADD CONSTRAINT "org_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_staff" ADD CONSTRAINT "org_staff_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_trial_profiles" ADD CONSTRAINT "organizer_trial_profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_trial_profiles" ADD CONSTRAINT "organizer_trial_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_applications" ADD CONSTRAINT "organizer_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_applications" ADD CONSTRAINT "organizer_applications_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_applications" ADD CONSTRAINT "organizer_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_reviews" ADD CONSTRAINT "event_reviews_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_reviews" ADD CONSTRAINT "event_reviews_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_reviews" ADD CONSTRAINT "event_reviews_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_syncs" ADD CONSTRAINT "external_syncs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sync_jobs" ADD CONSTRAINT "crm_sync_jobs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sync_jobs" ADD CONSTRAINT "crm_sync_jobs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_settings" ADD CONSTRAINT "event_settings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expo_halls" ADD CONSTRAINT "expo_halls_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booths" ADD CONSTRAINT "booths_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booths" ADD CONSTRAINT "booths_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "expo_halls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booths" ADD CONSTRAINT "booths_company_org_id_fkey" FOREIGN KEY ("company_org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booths" ADD CONSTRAINT "booths_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booth_bookings" ADD CONSTRAINT "booth_bookings_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booth_bookings" ADD CONSTRAINT "booth_bookings_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_registrations" ADD CONSTRAINT "participant_registrations_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_registrations" ADD CONSTRAINT "participant_registrations_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intent_tags" ADD CONSTRAINT "intent_tags_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_intent_tags" ADD CONSTRAINT "lead_intent_tags_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_intent_tags" ADD CONSTRAINT "lead_intent_tags_intent_tag_id_fkey" FOREIGN KEY ("intent_tag_id") REFERENCES "intent_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speakers" ADD CONSTRAINT "speakers_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_speakers" ADD CONSTRAINT "session_speakers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_speakers" ADD CONSTRAINT "session_speakers_speaker_id_fkey" FOREIGN KEY ("speaker_id") REFERENCES "speakers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "poll_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotteries" ADD CONSTRAINT "lotteries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotteries" ADD CONSTRAINT "lotteries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotteries" ADD CONSTRAINT "lotteries_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotteries" ADD CONSTRAINT "lotteries_require_poll_id_fkey" FOREIGN KEY ("require_poll_id") REFERENCES "polls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotteries" ADD CONSTRAINT "lotteries_quiz_poll_id_fkey" FOREIGN KEY ("quiz_poll_id") REFERENCES "polls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lottery_prizes" ADD CONSTRAINT "lottery_prizes_lottery_id_fkey" FOREIGN KEY ("lottery_id") REFERENCES "lotteries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lottery_entries" ADD CONSTRAINT "lottery_entries_lottery_id_fkey" FOREIGN KEY ("lottery_id") REFERENCES "lotteries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lottery_entries" ADD CONSTRAINT "lottery_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lottery_entries" ADD CONSTRAINT "lottery_entries_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_event_codes" ADD CONSTRAINT "user_event_codes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_event_codes" ADD CONSTRAINT "user_event_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_scan_logs" ADD CONSTRAINT "code_scan_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_scan_logs" ADD CONSTRAINT "code_scan_logs_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "user_event_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_scan_logs" ADD CONSTRAINT "code_scan_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lottery_winners" ADD CONSTRAINT "lottery_winners_lottery_id_fkey" FOREIGN KEY ("lottery_id") REFERENCES "lotteries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lottery_winners" ADD CONSTRAINT "lottery_winners_prize_id_fkey" FOREIGN KEY ("prize_id") REFERENCES "lottery_prizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lottery_winners" ADD CONSTRAINT "lottery_winners_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "lottery_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lottery_winners" ADD CONSTRAINT "lottery_winners_event_code_id_fkey" FOREIGN KEY ("event_code_id") REFERENCES "user_event_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lottery_winners" ADD CONSTRAINT "lottery_winners_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lottery_winners" ADD CONSTRAINT "lottery_winners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_sessions" ADD CONSTRAINT "interaction_sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_sessions" ADD CONSTRAINT "interaction_sessions_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_sessions" ADD CONSTRAINT "interaction_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screen_pairings" ADD CONSTRAINT "screen_pairings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_match_results" ADD CONSTRAINT "ai_match_results_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_event_intents" ADD CONSTRAINT "user_event_intents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_event_intents" ADD CONSTRAINT "user_event_intents_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_briefs" ADD CONSTRAINT "match_briefs_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_briefs" ADD CONSTRAINT "match_briefs_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_briefs" ADD CONSTRAINT "match_briefs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_feedbacks" ADD CONSTRAINT "match_feedbacks_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_feedbacks" ADD CONSTRAINT "match_feedbacks_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_feedbacks" ADD CONSTRAINT "match_feedbacks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_weight_tunings" ADD CONSTRAINT "match_weight_tunings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_insights" ADD CONSTRAINT "monthly_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedbacks" ADD CONSTRAINT "ai_feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_connections" ADD CONSTRAINT "business_connections_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_connections" ADD CONSTRAINT "business_connections_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_connections" ADD CONSTRAINT "business_connections_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_connections" ADD CONSTRAINT "business_connections_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_referrals" ADD CONSTRAINT "business_referrals_introducer_id_fkey" FOREIGN KEY ("introducer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_referrals" ADD CONSTRAINT "business_referrals_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_referrals" ADD CONSTRAINT "business_referrals_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_referrals" ADD CONSTRAINT "business_referrals_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_referrals" ADD CONSTRAINT "business_referrals_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "meeting_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_areas" ADD CONSTRAINT "meeting_areas_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_tables" ADD CONSTRAINT "meeting_tables_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "meeting_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_interactions" ADD CONSTRAINT "connection_interactions_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "business_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_cards" ADD CONSTRAINT "contact_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_requests" ADD CONSTRAINT "exchange_requests_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_requests" ADD CONSTRAINT "exchange_requests_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_requests" ADD CONSTRAINT "exchange_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_items" ADD CONSTRAINT "feed_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_items" ADD CONSTRAINT "feed_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_referral_scans" ADD CONSTRAINT "ai_referral_scans_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booth_visit_signals" ADD CONSTRAINT "booth_visit_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booth_visit_signals" ADD CONSTRAINT "booth_visit_signals_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sn_sessions" ADD CONSTRAINT "sn_sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sn_pairs" ADD CONSTRAINT "sn_pairs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sn_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sn_pairs" ADD CONSTRAINT "sn_pairs_participant_a_id_fkey" FOREIGN KEY ("participant_a_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sn_pairs" ADD CONSTRAINT "sn_pairs_participant_b_id_fkey" FOREIGN KEY ("participant_b_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_campaigns" ADD CONSTRAINT "invite_campaigns_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_campaigns" ADD CONSTRAINT "invite_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_records" ADD CONSTRAINT "invite_records_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "invite_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_records" ADD CONSTRAINT "invite_records_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_records" ADD CONSTRAINT "invite_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stamp_rallies" ADD CONSTRAINT "stamp_rallies_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stamp_rallies" ADD CONSTRAINT "stamp_rallies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stamp_rallies" ADD CONSTRAINT "stamp_rallies_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stamps" ADD CONSTRAINT "stamps_rally_id_fkey" FOREIGN KEY ("rally_id") REFERENCES "stamp_rallies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stamps" ADD CONSTRAINT "stamps_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stamps" ADD CONSTRAINT "user_stamps_stamp_id_fkey" FOREIGN KEY ("stamp_id") REFERENCES "stamps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stamps" ADD CONSTRAINT "user_stamps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stamp_progresses" ADD CONSTRAINT "user_stamp_progresses_rally_id_fkey" FOREIGN KEY ("rally_id") REFERENCES "stamp_rallies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stamp_progresses" ADD CONSTRAINT "user_stamp_progresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stamp_records" ADD CONSTRAINT "stamp_records_rally_id_fkey" FOREIGN KEY ("rally_id") REFERENCES "stamp_rallies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stamp_records" ADD CONSTRAINT "stamp_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stamp_records" ADD CONSTRAINT "stamp_records_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stamp_rally_winners" ADD CONSTRAINT "stamp_rally_winners_rally_id_fkey" FOREIGN KEY ("rally_id") REFERENCES "stamp_rallies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stamp_rally_winners" ADD CONSTRAINT "stamp_rally_winners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
