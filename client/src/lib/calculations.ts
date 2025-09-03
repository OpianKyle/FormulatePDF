import type { ProposalForm } from "@shared/schema";

export interface InvestmentCalculations {
  targetValue: number;
  totalProfit: number;
  annualizedReturn: number;
  calculatedTargetReturn: number;
  sharesIssued: number;
  year1Return: number;
  year1Value: number;
  year1Growth: number;
  year2Return: number;
  year2Value: number;
  year2Growth: number;
  year3Return: number;
  year3Value: number;
  year3Growth: number;
}

export function calculateInvestmentProjections(formData: Partial<ProposalForm>): InvestmentCalculations {
  const investmentAmount = formData.investmentAmount || 0;
  const targetReturn = formData.targetReturn || 0;
  const timeHorizon = formData.timeHorizon || 3;
  const year1Dividend = formData.year1Dividend || 0;
  const year2Dividend = formData.year2Dividend || 0;
  const year3Dividend = formData.year3Dividend || 0;

  // Calculate shares issued (assuming R8 per share based on original data)
  const sharesIssued = investmentAmount / 8;

  // Calculate yearly returns based on dividend allocations
  const year1Return = sharesIssued * year1Dividend;
  const year1Value = investmentAmount + year1Return;
  const year1Growth = investmentAmount > 0 ? (year1Return / investmentAmount) * 100 : 0;

  const year2Return = sharesIssued * year2Dividend;
  const year2Value = year1Value + year2Return;
  const year2Growth = year1Value > 0 ? (year2Return / year1Value) * 100 : 0;

  const year3Return = sharesIssued * year3Dividend;
  const year3Value = year2Value + year3Return;
  const year3Growth = year2Value > 0 ? (year3Return / year2Value) * 100 : 0;

  // Calculate target value based on dividend projections (final year value)
  const targetValue = year3Value;
  const totalProfit = targetValue - investmentAmount;
  const calculatedTargetReturn = investmentAmount > 0 ? ((targetValue - investmentAmount) / investmentAmount) * 100 : 0;
  const annualizedReturn = investmentAmount > 0 ? (Math.pow(targetValue / investmentAmount, 1 / timeHorizon) - 1) * 100 : 0;

  return {
    targetValue,
    totalProfit,
    annualizedReturn,
    calculatedTargetReturn,
    sharesIssued,
    year1Return,
    year1Value,
    year1Growth,
    year2Return,
    year2Value,
    year2Growth,
    year3Return,
    year3Value,
    year3Growth,
  };
}
