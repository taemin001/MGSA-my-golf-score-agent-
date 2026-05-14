import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getUserScorecards, getScorecardHoles, createAnalysisReport, getUserAnalysisReports } from "../db";
import { invokeLLM } from "../_core/llm";

/**
 * Analytics router - handles dashboard data and AI analyst reports
 */
export const analyticsRouter = router({
  /**
   * Get dashboard KPI data for a given period
   */
  getDashboardKPI: protectedProcedure
    .input(z.object({
      period: z.enum(["all", "year", "quarter", "month"]),
      quarterOrMonth: z.number().optional(), // 1-4 for quarter, 1-12 for month
      year: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const scorecards = await getUserScorecards(ctx.user.id);
      
      // Filter by period
      let filtered = scorecards;
      const now = new Date();
      
      if (input.period === "year") {
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        filtered = scorecards.filter(s => new Date(s.playedAt) >= oneYearAgo);
      } else if (input.period === "quarter" && input.quarterOrMonth) {
        const year = input.year || now.getFullYear();
        const startMonth = (input.quarterOrMonth - 1) * 3;
        const endMonth = startMonth + 3;
        filtered = scorecards.filter(s => {
          const d = new Date(s.playedAt);
          return d.getFullYear() === year && d.getMonth() >= startMonth && d.getMonth() < endMonth;
        });
      } else if (input.period === "month" && input.quarterOrMonth) {
        const year = input.year || now.getFullYear();
        const month = input.quarterOrMonth - 1;
        filtered = scorecards.filter(s => {
          const d = new Date(s.playedAt);
          return d.getFullYear() === year && d.getMonth() === month;
        });
      }

      // Calculate KPIs
      const totalRounds = filtered.length;
      const totalScores = filtered.map(s => s.totalScore).filter(s => s !== null) as number[];
      const averageScore = totalScores.length > 0 ? totalScores.reduce((a, b) => a + b) / totalScores.length : 0;
      const bestScore = totalScores.length > 0 ? Math.min(...totalScores) : null;
      const worstScore = totalScores.length > 0 ? Math.max(...totalScores) : null;

      // Get par 3/4/5 statistics
      const parStats: { par3: number[]; par4: number[]; par5: number[] } = { par3: [], par4: [], par5: [] };
      for (const scorecard of filtered) {
        const holes = await getScorecardHoles(scorecard.id);
        for (const hole of holes) {
          if (hole.par === 3) parStats.par3.push(hole.strokes || 0);
          else if (hole.par === 4) parStats.par4.push(hole.strokes || 0);
          else if (hole.par === 5) parStats.par5.push(hole.strokes || 0);
        }
      }

      const par3Avg = parStats.par3.length > 0 ? parStats.par3.reduce((a, b) => a + b) / parStats.par3.length : 0;
      const par4Avg = parStats.par4.length > 0 ? parStats.par4.reduce((a, b) => a + b) / parStats.par4.length : 0;
      const par5Avg = parStats.par5.length > 0 ? parStats.par5.reduce((a, b) => a + b) / parStats.par5.length : 0;

      return {
        totalRounds,
        averageScore: Math.round(averageScore * 10) / 10,
        bestScore,
        worstScore,
        par3Avg: Math.round(par3Avg * 10) / 10,
        par4Avg: Math.round(par4Avg * 10) / 10,
        par5Avg: Math.round(par5Avg * 10) / 10,
      };
    }),

  /**
   * Get monthly trend data for chart
   */
  getMonthlyTrend: protectedProcedure
    .input(z.object({
      year: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const scorecards = await getUserScorecards(ctx.user.id);
      
      // Group by month
      const monthlyData = Array(12).fill(null).map((_, i) => ({
        month: i + 1,
        average: 0,
        count: 0,
      }));

      for (const scorecard of scorecards) {
        const d = new Date(scorecard.playedAt);
        if (d.getFullYear() === input.year && scorecard.totalScore) {
          const monthIndex = d.getMonth();
          monthlyData[monthIndex].average += scorecard.totalScore;
          monthlyData[monthIndex].count += 1;
        }
      }

      return monthlyData.map(m => ({
        month: m.month,
        average: m.count > 0 ? Math.round((m.average / m.count) * 10) / 10 : 0,
      }));
    }),

  /**
   * Get recent rounds summary (last 5 rounds)
   */
  getRecentRoundsSummary: protectedProcedure
    .query(async ({ ctx }) => {
      const scorecards = await getUserScorecards(ctx.user.id);
      const recent = scorecards
        .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
        .slice(0, 5);

      const summaries = await Promise.all(
        recent.map(async (scorecard) => {
          const holes = await getScorecardHoles(scorecard.id);
          const birdies = holes.filter(h => h.strokes && h.par && h.strokes < h.par).length;
          const bogeys = holes.filter(h => h.strokes && h.par && h.strokes > h.par).length;
          
          return {
            id: scorecard.id,
            playedAt: scorecard.playedAt,
            clubName: scorecard.golfClubName,
            courseName: scorecard.courseName,
            totalScore: scorecard.totalScore,
            birdies,
            bogeys,
          };
        })
      );

      return summaries;
    }),

  /**
   * Generate AI Analyst report for a period
   */
  generateAnalystReport: protectedProcedure
    .input(z.object({
      periodType: z.enum(["all", "year", "quarter", "month"]),
      quarterOrMonth: z.number().optional(),
      year: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const scorecards = await getUserScorecards(ctx.user.id);
      
      // Filter by period
      let filtered = scorecards;
      const now = new Date();
      let startDate = new Date(0);
      let endDate = now;

      if (input.periodType === "year") {
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        filtered = scorecards.filter(s => new Date(s.playedAt) >= startDate);
      } else if (input.periodType === "quarter" && input.quarterOrMonth) {
        const year = input.year || now.getFullYear();
        const startMonth = (input.quarterOrMonth - 1) * 3;
        startDate = new Date(year, startMonth, 1);
        endDate = new Date(year, startMonth + 3, 0);
        filtered = scorecards.filter(s => {
          const d = new Date(s.playedAt);
          return d >= startDate && d <= endDate;
        });
      } else if (input.periodType === "month" && input.quarterOrMonth) {
        const year = input.year || now.getFullYear();
        const month = input.quarterOrMonth - 1;
        startDate = new Date(year, month, 1);
        endDate = new Date(year, month + 1, 0);
        filtered = scorecards.filter(s => {
          const d = new Date(s.playedAt);
          return d >= startDate && d <= endDate;
        });
      }

      // Prepare data for LLM analysis
      const analysisData = {
        totalRounds: filtered.length,
        scores: filtered.map(s => s.totalScore).filter(s => s !== null),
        rounds: await Promise.all(
          filtered.map(async (s) => ({
            date: s.playedAt,
            club: s.golfClubName,
            course: s.courseName,
            score: s.totalScore,
            frontNine: s.frontNineScore,
            backNine: s.backNineScore,
          }))
        ),
      };

      // Generate report using LLM
      const prompt = `
당신은 프로 골프 분석가입니다. 다음 골프 스코어 데이터를 분석하여 전문적인 리포트를 작성해주세요.

분석 데이터:
- 총 라운드 수: ${analysisData.totalRounds}
- 스코어: ${analysisData.scores.join(", ")}
- 평균: ${analysisData.scores.length > 0 ? (analysisData.scores.reduce((a, b) => a + b) / analysisData.scores.length).toFixed(1) : "N/A"}
- 최고: ${Math.min(...analysisData.scores)}
- 최저: ${Math.max(...analysisData.scores)}

다음 항목을 포함하여 한국어로 작성해주세요:
1. 기간 요약 (2-3문장)
2. 핵심 성과 지표 (3-4개 항목)
3. 경기력 패턴 분석
4. 플레이 스타일 특징
5. 개선 포인트 (2-3개)
6. 다음 라운드 제안

신뢰감 있고 전문적인 톤으로 작성하며, 과장하지 않고 데이터 기반의 분석을 제공하세요.
      `;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "당신은 전문적인 골프 성과 분석가입니다. 신뢰감 있고 데이터 기반의 분석을 제공합니다.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const reportContent = response.choices[0]?.message.content;
      if (typeof reportContent !== "string") {
        throw new Error("Invalid LLM response");
      }

      // Save report to database
      await createAnalysisReport({
        userId: ctx.user.id,
        periodType: input.periodType as any,
        startDate,
        endDate,
        summary: reportContent.split("\n").slice(0, 3).join(" "),
        insightsJson: JSON.stringify(analysisData),
      });

      return {
        success: true,
        report: reportContent,
      };
    }),

  /**
   * Get saved analysis reports
   */
  getSavedReports: protectedProcedure
    .query(async ({ ctx }) => {
      const reports = await getUserAnalysisReports(ctx.user.id);
      return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }),
});
