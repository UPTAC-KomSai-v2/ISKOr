// server/src/utils/insights.ts
import mongoose from "mongoose";

type ObjectId = mongoose.Types.ObjectId;

export type BasicSubmission = {
  _id: ObjectId;
  studentId: ObjectId;
  examId: ObjectId;
  startedAt: Date;
  submittedAt?: Date;
  totalScore: number;
  percentage: number;
  isPassing: boolean;
  answers: Array<{
    questionId: ObjectId;
    selectedChoiceId?: ObjectId;
    booleanAnswer?: boolean;
    textAnswer?: string;
    pointsEarned: number;
    isCorrect?: boolean;
  }>;
};

export type BasicQuestion = {
  _id: ObjectId;
  examId: ObjectId;
  type: string;
  points: number;
  choices?: Array<{ _id?: ObjectId; isCorrect: boolean }>;
  correctAnswer?: boolean;
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
};

function mean(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = mean(xs.map(x => (x - m) ** 2));
  return Math.sqrt(v);
}

function pearsonCorr(x: number[], y: number[]) {
  if (x.length !== y.length || x.length < 2) return 0;
  const mx = mean(x), my = mean(y);
  const num = x.reduce((acc, xi, i) => acc + (xi - mx) * (y[i] - my), 0);
  const den = Math.sqrt(x.reduce((acc, xi) => acc + (xi - mx) ** 2, 0)) * Math.sqrt(y.reduce((acc, yi) => acc + (yi - my) ** 2, 0));
  if (den === 0) return 0;
  return num / den;
}

function percentileValue(sortedAsc: number[], p: number) {
  if (!sortedAsc.length) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(p * sortedAsc.length)));
  return sortedAsc[idx];
}

// Re-evaluate correctness if isCorrect wasn’t stored consistently.
export function isAnswerCorrect(question: BasicQuestion, answer: any): boolean | undefined {
  switch (question.type) {
    case "MULTIPLE_CHOICE": {
      if (!answer?.selectedChoiceId || !question.choices) return undefined;
      const selected = question.choices.find(c => c._id?.toString() === answer.selectedChoiceId?.toString());
      return !!selected?.isCorrect;
    }
    case "TRUE_FALSE":
      if (answer?.booleanAnswer === undefined) return undefined;
      return answer.booleanAnswer === question.correctAnswer;
    case "SHORT_ANSWER":
    case "FILL_IN_BLANK": {
      const txt = answer?.textAnswer;
      if (!txt || !question.acceptedAnswers?.length) return undefined;
      const user = question.caseSensitive ? txt.trim() : txt.trim().toLowerCase();
      return question.acceptedAnswers.some(a => {
        const acc = question.caseSensitive ? a.trim() : a.trim().toLowerCase();
        return user === acc;
      });
    }
    // ESSAY / MATCHING etc. => typically manual
    default:
      return undefined;
  }
}

export function computeExamLevelMetrics(submissions: BasicSubmission[]) {
  const completed = submissions.filter(s => !!s.submittedAt);
  const total = completed.length;

  if (!total) {
    return {
      totalSubmissions: 0,
      averageScore: 0,
      averagePercentage: 0,
      passingRate: 0,
      averageTimeTakenMinutes: 0,
      scoreRange: { min: 0, max: 0 },
    };
  }

  const scores = completed.map(s => s.totalScore);
  const percentages = completed.map(s => s.percentage);
  const passing = completed.filter(s => s.isPassing).length;

  const timeTakenMin = completed.map(s => {
    const ms = new Date(s.submittedAt!).getTime() - new Date(s.startedAt).getTime();
    return Math.max(0, ms / 60000);
  });

  return {
    totalSubmissions: total,
    averageScore: mean(scores),
    averagePercentage: mean(percentages),
    passingRate: (passing / total) * 100,
    averageTimeTakenMinutes: mean(timeTakenMin),
    scoreRange: { min: Math.min(...scores), max: Math.max(...scores) },
  };
}

export function computePercentiles(submissions: BasicSubmission[]) {
  const completed = submissions.filter(s => !!s.submittedAt);
  const percentages = completed.map(s => s.percentage).sort((a, b) => a - b);

  return {
    p90: percentileValue(percentages, 0.90),
    p75: percentileValue(percentages, 0.75),
    p50: percentileValue(percentages, 0.50),
    p25: percentileValue(percentages, 0.25),
  };
}

export function computeItemAnalysis(
  questions: BasicQuestion[],
  submissions: BasicSubmission[]
) {
  const completed = submissions.filter(s => !!s.submittedAt);
  if (!completed.length) return [];

  // Rank submissions by total score (or percentage)
  const ranked = [...completed].sort((a, b) => (b.totalScore - a.totalScore));
  const n = ranked.length;
  const groupSize = Math.max(1, Math.floor(n * 0.27)); // classic 27% split
  const topGroup = ranked.slice(0, groupSize);
  const bottomGroup = ranked.slice(n - groupSize);

  const totalScores = completed.map(s => s.totalScore);

  return questions.map(q => {
    let correct = 0;
    let attempted = 0;
    let skipped = 0;

    const itemCorrectFlags: number[] = [];
    const itemTotalScores: number[] = [];

    for (const s of completed) {
      const a = s.answers.find(x => x.questionId.toString() === q._id.toString());
      const hasResponse =
        a &&
        (a.selectedChoiceId ||
          a.booleanAnswer !== undefined ||
          (a.textAnswer && a.textAnswer.trim() !== ""));

      if (!hasResponse) {
        skipped += 1;
        continue;
      }

      attempted += 1;

      const stored = a?.isCorrect;
      const derived = stored !== undefined ? stored : isAnswerCorrect(q, a);
      const isCorrect = derived === true;

      if (isCorrect) correct += 1;

      // for point-biserial: 1 if correct else 0, and total score
      itemCorrectFlags.push(isCorrect ? 1 : 0);
      itemTotalScores.push(s.totalScore);
    }

    const p = attempted ? correct / attempted : 0; // difficulty index
    const skipRate = completed.length ? (skipped / completed.length) * 100 : 0;

    // discrimination index D = p_top - p_bottom
    const pTop = calcGroupP(q, topGroup);
    const pBottom = calcGroupP(q, bottomGroup);
    const D = pTop - pBottom;

    // point-biserial ~ correlation(itemCorrect, totalScore)
    const rpb = pearsonCorr(itemCorrectFlags, itemTotalScores);

    return {
      questionId: q._id,
      difficultyIndex: p, // 0..1
      discriminationIndex: D, // -1..1
      pointBiserial: rpb, // -1..1
      skipRatePercent: skipRate, // 0..100
      attemptedCount: attempted,
      correctCount: correct,
      totalSubmissions: completed.length,
    };
  });

  function calcGroupP(question: BasicQuestion, group: BasicSubmission[]) {
    let c = 0, a = 0;
    for (const s of group) {
      const ans = s.answers.find(x => x.questionId.toString() === question._id.toString());
      const hasResponse =
        ans &&
        (ans.selectedChoiceId ||
          ans.booleanAnswer !== undefined ||
          (ans.textAnswer && ans.textAnswer.trim() !== ""));

      if (!hasResponse) continue;
      a += 1;

      const stored = ans?.isCorrect;
      const derived = stored !== undefined ? stored : isAnswerCorrect(question, ans);
      if (derived === true) c += 1;
    }
    return a ? c / a : 0;
  }
}

export function computeStudentStanding(
  submissions: BasicSubmission[],
  studentId: string
) {
  const completed = submissions.filter(s => !!s.submittedAt);
  if (!completed.length) {
    return {
      rank: null,
      outOf: 0,
      percentileRank: null,
      aboveBelowAverage: null,
      quartile: null,
      classAverage: 0,
    };
  }

  const sorted = [...completed].sort((a, b) => b.percentage - a.percentage);
  const outOf = sorted.length;
  const idx = sorted.findIndex(s => s.studentId.toString() === studentId);
  const rank = idx >= 0 ? idx + 1 : null;

  const studentPct = idx >= 0 ? sorted[idx].percentage : null;
  const classAvg = mean(sorted.map(s => s.percentage));
  const aboveBelowAverage = studentPct === null ? null : (studentPct - classAvg);

  // percentile rank (higher is better)
  let percentileRank: number | null = null;
  if (studentPct !== null) {
    const belowOrEqual = sorted.filter(s => s.percentage <= studentPct).length;
    percentileRank = (belowOrEqual / outOf) * 100;
  }

  // quartile position using p25/p50/p75
  const asc = [...sorted].map(s => s.percentage).sort((a, b) => a - b);
  const q1 = percentileValue(asc, 0.25);
  const q2 = percentileValue(asc, 0.50);
  const q3 = percentileValue(asc, 0.75);

  let quartile: "Q1" | "Q2" | "Q3" | "Q4" | null = null;
  if (studentPct !== null) {
    quartile =
      studentPct <= q1 ? "Q1" :
      studentPct <= q2 ? "Q2" :
      studentPct <= q3 ? "Q3" : "Q4";
  }

  return {
    rank,
    outOf,
    percentileRank,
    aboveBelowAverage,
    quartile,
    classAverage: classAvg,
  };
}

export function computeScoreDistribution(submissions: BasicSubmission[]) {
  // simple 10-point bins: 0-9, 10-19, ... 90-100
  const completed = submissions.filter(s => !!s.submittedAt);
  const bins = Array.from({ length: 11 }, (_, i) => ({
    label: i === 10 ? "100" : `${i * 10}-${i * 10 + 9}`,
    count: 0,
  }));

  for (const s of completed) {
    const pct = Math.max(0, Math.min(100, s.percentage));
    const idx = pct === 100 ? 10 : Math.floor(pct / 10);
    bins[idx].count += 1;
  }

  return bins;
}

export function computeExamDifficultyComparison(exams: Array<{ _id: any; title: string }>, examAverages: Map<string, number>) {
  // Lower average => “harder” heuristic (good enough for dashboard)
  return exams.map(e => ({
    examId: e._id,
    title: e.title,
    averagePercentage: examAverages.get(e._id.toString()) ?? 0,
  })).sort((a, b) => a.averagePercentage - b.averagePercentage);
}
