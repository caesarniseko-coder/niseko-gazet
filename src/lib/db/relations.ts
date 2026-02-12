import { relations } from "drizzle-orm";
import {
  users,
  fieldNotes,
  stories,
  storyVersions,
  approvalRecords,
  deliveryLogs,
  subscriptions,
  userPreferences,
  moderationQueue,
  auditLogs,
} from "./schema";

export const usersRelations = relations(users, ({ many, one }) => ({
  fieldNotes: many(fieldNotes),
  stories: many(stories),
  approvalRecords: many(approvalRecords),
  deliveryLogs: many(deliveryLogs),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId],
  }),
  moderationReviews: many(moderationQueue),
  auditLogs: many(auditLogs),
}));

export const fieldNotesRelations = relations(fieldNotes, ({ one, many }) => ({
  author: one(users, {
    fields: [fieldNotes.authorId],
    references: [users.id],
  }),
  stories: many(stories),
}));

export const storiesRelations = relations(stories, ({ one, many }) => ({
  author: one(users, {
    fields: [stories.authorId],
    references: [users.id],
  }),
  fieldNote: one(fieldNotes, {
    fields: [stories.fieldNoteId],
    references: [fieldNotes.id],
  }),
  versions: many(storyVersions),
  approvalRecords: many(approvalRecords),
  deliveryLogs: many(deliveryLogs),
  moderationItems: many(moderationQueue),
}));

export const storyVersionsRelations = relations(storyVersions, ({ one }) => ({
  story: one(stories, {
    fields: [storyVersions.storyId],
    references: [stories.id],
  }),
}));

export const approvalRecordsRelations = relations(
  approvalRecords,
  ({ one }) => ({
    story: one(stories, {
      fields: [approvalRecords.storyId],
      references: [stories.id],
    }),
    approver: one(users, {
      fields: [approvalRecords.approverId],
      references: [users.id],
    }),
  })
);

export const deliveryLogsRelations = relations(deliveryLogs, ({ one }) => ({
  user: one(users, {
    fields: [deliveryLogs.userId],
    references: [users.id],
  }),
  story: one(stories, {
    fields: [deliveryLogs.storyId],
    references: [stories.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const userPreferencesRelations = relations(
  userPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [userPreferences.userId],
      references: [users.id],
    }),
  })
);

export const moderationQueueRelations = relations(
  moderationQueue,
  ({ one }) => ({
    reviewer: one(users, {
      fields: [moderationQueue.reviewedBy],
      references: [users.id],
    }),
    story: one(stories, {
      fields: [moderationQueue.relatedStoryId],
      references: [stories.id],
    }),
  })
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}));
