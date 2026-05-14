import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with golf-specific data model.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Golf course information (e.g., course name, location, official info)
 */
export const golfCourses = mysqlTable("golf_courses", {
  id: int("id").autoincrement().primaryKey(),
  clubName: varchar("club_name", { length: 255 }).notNull(),
  courseName: varchar("course_name", { length: 255 }).notNull(),
  sourceUrl: text("source_url"),
  verifiedStatus: mysqlEnum("verified_status", ["verified", "unverified", "pending"]).default("unverified").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GolfCourse = typeof golfCourses.$inferSelect;
export type InsertGolfCourse = typeof golfCourses.$inferInsert;

/**
 * Individual hole information for a golf course
 * (e.g., Par 3/4/5, handicap index, yardage)
 */
export const golfCourseHoles = mysqlTable("golf_course_holes", {
  id: int("id").autoincrement().primaryKey(),
  golfCourseId: int("golf_course_id").notNull(),
  holeNumber: int("hole_number").notNull(),
  par: int("par").notNull(), // 3, 4, or 5
  handicapIndex: int("handicap_index"),
  yardage: int("yardage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GolfCourseHole = typeof golfCourseHoles.$inferSelect;
export type InsertGolfCourseHole = typeof golfCourseHoles.$inferInsert;

/**
 * User's scorecard (one round of golf)
 * Stores metadata about the round and OCR extraction status
 */
export const scorecards = mysqlTable("scorecards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  playedAt: timestamp("played_at").notNull(),
  golfClubName: varchar("golf_club_name", { length: 255 }),
  courseName: varchar("course_name", { length: 255 }),
  golfCourseId: int("golf_course_id"), // FK to matched golf course
  sourceType: mysqlEnum("source_type", ["image", "file", "manual"]).notNull(),
  originalFileUrl: text("original_file_url"), // S3 URL
  ocrStatus: mysqlEnum("ocr_status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  reviewStatus: mysqlEnum("review_status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  totalScore: int("total_score"),
  frontNineScore: int("front_nine_score"),
  backNineScore: int("back_nine_score"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Scorecard = typeof scorecards.$inferSelect;
export type InsertScorecard = typeof scorecards.$inferInsert;

/**
 * Individual hole scores for a scorecard
 * Stores the number of strokes for each hole and Par information
 */
export const scorecardHoles = mysqlTable("scorecard_holes", {
  id: int("id").autoincrement().primaryKey(),
  scorecardId: int("scorecard_id").notNull(),
  holeNumber: int("hole_number").notNull(),
  strokes: int("strokes"),
  par: int("par"), // 3, 4, or 5
  matchedCourseHoleId: int("matched_course_hole_id"), // FK to golf_course_holes
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScorecardHole = typeof scorecardHoles.$inferSelect;
export type InsertScorecardHole = typeof scorecardHoles.$inferInsert;

/**
 * AI-generated analysis reports
 * Stores summary and detailed insights for a given period
 */
export const analysisReports = mysqlTable("analysis_reports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  periodType: mysqlEnum("period_type", ["all", "year", "quarter", "month", "custom"]).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  summary: text("summary"), // Short text summary
  insightsJson: json("insights_json"), // Structured insights object
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalysisReport = typeof analysisReports.$inferSelect;
export type InsertAnalysisReport = typeof analysisReports.$inferInsert;
