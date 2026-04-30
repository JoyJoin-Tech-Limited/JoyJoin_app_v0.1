import { adminAccountsRepo, type AdminAccountsRepository } from "./repositories/adminAccountsRepo";
import { assessmentRepo, type AssessmentRepository } from "./repositories/assessmentRepo";
import { attendanceRepo, type AttendanceRepository } from "./repositories/attendanceRepo";
import { blindBoxEventsRepo, type BlindBoxEventsRepository } from "./repositories/blindBoxEventsRepo";
import { eventPoolsRepo, type EventPoolsRepository } from "./repositories/eventPoolsRepo";
import { icebreakerRepo, type IcebreakerRepository } from "./repositories/icebreakerRepo";
import { legacyStorageRepo } from "./repositories/legacyStorageRepo";
import { matchingConfigRepo, type MatchingConfigRepository } from "./repositories/matchingConfigRepo";
import { moderationRepo, type ModerationRepository } from "./repositories/moderationRepo";
import { notificationsRepo, type NotificationsRepository } from "./repositories/notificationsRepo";
import { onboardingRepo, type OnboardingRepository } from "./repositories/onboardingRepo";
import { paymentsRepo, type PaymentsRepository } from "./repositories/paymentsRepo";
import { pricingRepo, type PricingRepository } from "./repositories/pricingRepo";
import { registrationTelemetryRepo, type RegistrationTelemetryRepository } from "./repositories/registrationTelemetryRepo";
import { shareCardRepo, type ShareCardRepository } from "./repositories/shareCardRepo";
import { usersRepo, type UsersRepository } from "./repositories/usersRepo";
import { venuesRepo, type VenuesRepository } from "./repositories/venuesRepo";

export type IStorage = typeof legacyStorageRepo
  & OnboardingRepository
  & UsersRepository
  & AssessmentRepository
  & NotificationsRepository
  & PaymentsRepository
  & EventPoolsRepository
  & IcebreakerRepository
  & BlindBoxEventsRepository
  & VenuesRepository
  & AttendanceRepository
  & AdminAccountsRepository
  & PricingRepository
  & ModerationRepository
  & MatchingConfigRepository
  & RegistrationTelemetryRepository
  & ShareCardRepository;

export const storage: IStorage = Object.assign(
  legacyStorageRepo,
  onboardingRepo,
  usersRepo,
  assessmentRepo,
  notificationsRepo,
  paymentsRepo,
  eventPoolsRepo,
  icebreakerRepo,
  blindBoxEventsRepo,
  venuesRepo,
  attendanceRepo,
  adminAccountsRepo,
  pricingRepo,
  moderationRepo,
  matchingConfigRepo,
  registrationTelemetryRepo,
  shareCardRepo,
);
