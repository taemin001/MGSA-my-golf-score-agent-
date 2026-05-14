import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, scorecards, InsertScorecard, scorecardHoles, InsertScorecardHole, golfCourses, InsertGolfCourse, golfCourseHoles, InsertGolfCourseHole, analysisReports, InsertAnalysisReport } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Golf scorecard queries
export async function createScorecard(data: InsertScorecard) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(scorecards).values(data);
  return result;
}

export async function getUserScorecards(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(scorecards).where(eq(scorecards.userId, userId));
}

export async function getScorecardById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(scorecards).where(eq(scorecards.id, id)).limit(1);
  return result[0];
}

export async function updateScorecard(id: number, data: Partial<InsertScorecard>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(scorecards).set(data).where(eq(scorecards.id, id));
}

export async function getScorecardHoles(scorecardId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(scorecardHoles).where(eq(scorecardHoles.scorecardId, scorecardId));
}

export async function createScorecardHole(data: InsertScorecardHole) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(scorecardHoles).values(data);
}

export async function updateScorecardHole(id: number, data: Partial<InsertScorecardHole>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(scorecardHoles).set(data).where(eq(scorecardHoles.id, id));
}

export async function findOrCreateGolfCourse(clubName: string, courseName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(golfCourses)
    .where(and(eq(golfCourses.clubName, clubName), eq(golfCourses.courseName, courseName)))
    .limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(golfCourses).values({ clubName, courseName });
  const newCourse = await db.select().from(golfCourses)
    .where(and(eq(golfCourses.clubName, clubName), eq(golfCourses.courseName, courseName)))
    .limit(1);
  return newCourse[0];
}

export async function getGolfCourseHoles(golfCourseId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(golfCourseHoles).where(eq(golfCourseHoles.golfCourseId, golfCourseId));
}

export async function createGolfCourseHole(data: InsertGolfCourseHole) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(golfCourseHoles).values(data);
}

export async function createAnalysisReport(data: InsertAnalysisReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(analysisReports).values(data);
}

export async function getUserAnalysisReports(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(analysisReports).where(eq(analysisReports.userId, userId));
}

// TODO: add more feature queries here as your schema grows.
