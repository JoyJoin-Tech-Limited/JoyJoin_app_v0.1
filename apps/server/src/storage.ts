import { assessmentRepo, type AssessmentRepository } from "./repositories/assessmentRepo";
import { eventPoolsRepo, type EventPoolsRepository } from "./repositories/eventPoolsRepo";
import { icebreakerRepo, type IcebreakerRepository } from "./repositories/icebreakerRepo";
import { legacyStorageRepo, type LegacyStorage } from "./repositories/legacyStorageRepo";
import { notificationsRepo, type NotificationsRepository } from "./repositories/notificationsRepo";
import { onboardingRepo, type OnboardingRepository } from "./repositories/onboardingRepo";
import { paymentsRepo, type PaymentsRepository } from "./repositories/paymentsRepo";
import { usersRepo, type UsersRepository } from "./repositories/usersRepo";

export type IStorage = LegacyStorage
  & OnboardingRepository
  & UsersRepository
  & AssessmentRepository
  & NotificationsRepository
  & PaymentsRepository
  & EventPoolsRepository
  & IcebreakerRepository;

export const storage: IStorage = Object.assign(
  legacyStorageRepo,
  onboardingRepo,
  usersRepo,
  assessmentRepo,
  notificationsRepo,
  paymentsRepo,
  eventPoolsRepo,
  icebreakerRepo,
);
