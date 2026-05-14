import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { 
  createScorecard, 
  getUserScorecards, 
  getScorecardById, 
  updateScorecard,
  getScorecardHoles,
  createScorecardHole,
  updateScorecardHole,
  findOrCreateGolfCourse,
  getGolfCourseHoles,
  createGolfCourseHole
} from "../db";
import { storagePut } from "../storage";
import { invokeLLM } from "../_core/llm";

/**
 * Scorecard router - handles all scorecard-related operations
 */
export const scorecardRouter = router({
  /**
   * Upload a scorecard image/file and initiate OCR processing
   */
  upload: protectedProcedure
    .input(z.object({
      file: z.instanceof(Buffer),
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Store file in S3
        const fileKey = `${ctx.user.id}/scorecards/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, input.file, input.mimeType);

        // Create scorecard record with pending OCR status
        await createScorecard({
          userId: ctx.user.id,
          playedAt: new Date(),
          sourceType: "image",
          originalFileUrl: url,
          ocrStatus: "pending",
          reviewStatus: "pending",
        });

        // Get the created scorecard
        const scorecards = await getUserScorecards(ctx.user.id);
        const newScorecard = scorecards[scorecards.length - 1];

        return {
          success: true,
          scorecardId: newScorecard.id,
          fileUrl: url,
        };
      } catch (error) {
        console.error("Upload error:", error);
        throw new Error("Failed to upload scorecard");
      }
    }),

  /**
   * Extract scorecard data using LLM/OCR
   */
  extractData: protectedProcedure
    .input(z.object({
      scorecardId: z.number(),
      imageUrl: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Update status to processing
        await updateScorecard(input.scorecardId, { ocrStatus: "processing" });

        // Use LLM to extract scorecard data
        const extractionPrompt = `
You are a golf scorecard data extraction expert. Analyze the golf scorecard image and extract the following information in JSON format:

{
  "playedAt": "YYYY-MM-DD",
  "golfClubName": "Golf club name",
  "courseName": "Course name",
  "frontNineScore": number,
  "backNineScore": number,
  "totalScore": number,
  "holes": [
    { "holeNumber": 1, "strokes": number, "par": number },
    ...
  ]
}

If any information is unclear or missing, use null for that field.
Return ONLY valid JSON, no markdown formatting.
        `;

        const response = await invokeLLM({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: extractionPrompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: input.imageUrl,
                  },
                },
              ],
            },
          ],
        });

        // Parse LLM response
        const content = response.choices[0]?.message.content;
        if (typeof content !== "string") {
          throw new Error("Invalid LLM response");
        }

        const extractedData = JSON.parse(content);

        // Update scorecard with extracted data
        await updateScorecard(input.scorecardId, {
          playedAt: extractedData.playedAt ? new Date(extractedData.playedAt) : undefined,
          golfClubName: extractedData.golfClubName,
          courseName: extractedData.courseName,
          frontNineScore: extractedData.frontNineScore,
          backNineScore: extractedData.backNineScore,
          totalScore: extractedData.totalScore,
          ocrStatus: "completed",
        });

        // Create hole records
        if (extractedData.holes && Array.isArray(extractedData.holes)) {
          for (const hole of extractedData.holes) {
            await createScorecardHole({
              scorecardId: input.scorecardId,
              holeNumber: hole.holeNumber,
              strokes: hole.strokes,
              par: hole.par,
            });
          }
        }

        return {
          success: true,
          extractedData,
        };
      } catch (error) {
        console.error("Extraction error:", error);
        await updateScorecard(input.scorecardId, { ocrStatus: "failed" });
        throw new Error("Failed to extract scorecard data");
      }
    }),

  /**
   * Get scorecard for review (original image + extracted data)
   */
  getForReview: protectedProcedure
    .input(z.object({ scorecardId: z.number() }))
    .query(async ({ input, ctx }) => {
      const scorecard = await getScorecardById(input.scorecardId);
      if (!scorecard || scorecard.userId !== ctx.user.id) {
        throw new Error("Scorecard not found");
      }

      const holes = await getScorecardHoles(input.scorecardId);

      return {
        scorecard,
        holes,
      };
    }),

  /**
   * Update scorecard after user review
   */
  updateAfterReview: protectedProcedure
    .input(z.object({
      scorecardId: z.number(),
      playedAt: z.date(),
      golfClubName: z.string(),
      courseName: z.string(),
      frontNineScore: z.number(),
      backNineScore: z.number(),
      totalScore: z.number(),
      holes: z.array(z.object({
        id: z.number().optional(),
        holeNumber: z.number(),
        strokes: z.number(),
        par: z.number(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const scorecard = await getScorecardById(input.scorecardId);
      if (!scorecard || scorecard.userId !== ctx.user.id) {
        throw new Error("Scorecard not found");
      }

      // Update scorecard
      await updateScorecard(input.scorecardId, {
        playedAt: input.playedAt,
        golfClubName: input.golfClubName,
        courseName: input.courseName,
        frontNineScore: input.frontNineScore,
        backNineScore: input.backNineScore,
        totalScore: input.totalScore,
        reviewStatus: "approved",
      });

      // Update holes
      for (const hole of input.holes) {
        if (hole.id) {
          await updateScorecardHole(hole.id, {
            strokes: hole.strokes,
            par: hole.par,
          });
        } else {
          await createScorecardHole({
            scorecardId: input.scorecardId,
            holeNumber: hole.holeNumber,
            strokes: hole.strokes,
            par: hole.par,
          });
        }
      }

      return { success: true };
    }),

  /**
   * Get user's scorecards list
   */
  list: protectedProcedure
    .input(z.object({
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ input, ctx }) => {
      const scorecards = await getUserScorecards(ctx.user.id);
      return scorecards
        .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
        .slice(input.offset, input.offset + input.limit);
    }),

  /**
   * Get scorecard detail with holes
   */
  getDetail: protectedProcedure
    .input(z.object({ scorecardId: z.number() }))
    .query(async ({ input, ctx }) => {
      const scorecard = await getScorecardById(input.scorecardId);
      if (!scorecard || scorecard.userId !== ctx.user.id) {
        throw new Error("Scorecard not found");
      }

      const holes = await getScorecardHoles(input.scorecardId);
      return { scorecard, holes };
    }),

  /**
   * Match golf course and holes
   */
  matchGolfCourse: protectedProcedure
    .input(z.object({
      scorecardId: z.number(),
      clubName: z.string(),
      courseName: z.string(),
      holes: z.array(z.object({
        holeNumber: z.number(),
        par: z.number(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const scorecard = await getScorecardById(input.scorecardId);
      if (!scorecard || scorecard.userId !== ctx.user.id) {
        throw new Error("Scorecard not found");
      }

      // Find or create golf course
      const golfCourse = await findOrCreateGolfCourse(input.clubName, input.courseName);

      // Create or update course holes
      for (const hole of input.holes) {
        const existingHoles = await getGolfCourseHoles(golfCourse.id);
        const exists = existingHoles.some(h => h.holeNumber === hole.holeNumber);
        if (!exists) {
          await createGolfCourseHole({
            golfCourseId: golfCourse.id,
            holeNumber: hole.holeNumber,
            par: hole.par,
          });
        }
      }

      // Update scorecard with golf course reference
      await updateScorecard(input.scorecardId, {
        golfCourseId: golfCourse.id,
      });

      return { success: true, golfCourseId: golfCourse.id };
    }),
});
